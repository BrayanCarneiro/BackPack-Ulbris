import test from 'node:test';
import assert from 'node:assert/strict';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import { allItems } from '../src/data/shopCatalog.js';
import { getReadyFusions, getIronFusionChoices } from '../src/utils/itemFusions.js';

const piece = (catalogId, id, x, y) => ({ ...allItems.find(item => item.id === catalogId), catalogId, id, x, y });
function sessionWith(items) {
  const session = new ShoppingSession();
  session.board.bags.push({ id: 'bag', kind: 'bag', x: 0, y: 0, width: 8, height: 8 });
  session.board.items.push(...items);
  return session;
}
function sharedIron() {
  return sessionWith([piece('sword', 'sword', 1, 1), piece('shield', 'shield', 3, 1),
    piece('refined-iron', 'iron', 2, 1)]);
}
const result = session => getReadyFusions(session.board.items)[0]?.resultId;

test('dropping the middle iron in the same cell cycles sword, shield, sword and battle honors the choice', () => {
  for (const drops of [1, 2, 3]) {
    const session = sharedIron();
    assert.equal(result(session), 'iron-sword');
    for (let i = 0; i < drops; i++) {
      assert.equal(session.board.move('item', 'iron', 2, 1), null);
      assert.equal(result(session), i % 2 ? 'iron-sword' : 'iron-shield');
    }
    const before = structuredClone(session.board.items);
    for (let i = 0; i < 5; i++) getReadyFusions(session.board.items);
    assert.deepEqual(session.board.items, before, 'refreshes do not cycle the choice');
    session.beginBattle();
    assert.equal(session.finishBattle('victory').fusions, 1);
    assert.equal(session.board.items.find(item => item.id === 'shield').catalogId, drops % 2 ? 'iron-shield' : 'shield');
    assert.equal(session.board.items.find(item => item.id === 'sword').catalogId, drops % 2 ? 'sword' : 'iron-sword');
  }
});

test('iron recipes work along all four borders and any rotation, excluding gaps and diagonals', () => {
  for (const [id, expected] of [['sword', 'iron-sword'], ['shield', 'iron-shield'], ['leather-helmet', 'iron-helmet']]) {
    const target = piece(id, 'target', 2, 2);
    for (let turns = 0; turns < 4; turns++) {
      for (const [x, y] of [[1, 2], [2 + target.width, 2], [2, 1], [2, 2 + target.height]]) {
        const iron = { ...piece('refined-iron', 'iron', x, y), rotation: turns * 90 };
        assert.equal(result(sessionWith([target, iron])), expected, `${id} at ${x},${y}, rotation ${turns}`);
      }
    }
    for (const [x, y] of [[1, 1], [2, target.y + target.height + 1], [null, null]]) {
      assert.equal(result(sessionWith([target, piece('refined-iron', 'iron', x, y)])), undefined);
    }
  }
});

test('failed drops and rotation preserve choice; relocating or storing resets it', () => {
  const session = sharedIron();
  session.board.move('item', 'iron', 2, 1);
  assert.equal(result(session), 'iron-shield');
  assert.ok(session.board.move('item', 'iron', 1, 1));
  assert.equal(result(session), 'iron-shield');
  assert.equal(session.board.move('item', 'iron', 2, 1, 1), null);
  assert.equal(result(session), 'iron-shield');
  session.board.move('item', 'iron', 2, 2);
  assert.equal(result(session), 'iron-sword');
  session.board.move('item', 'iron', 2, 1);
  session.board.move('item', 'iron', 2, 1);
  assert.equal(result(session), 'iron-shield');
  session.board.store('item', 'iron');
  assert.equal(result(session), undefined);
  session.board.move('item', 'iron', 2, 1);
  assert.equal(result(session), 'iron-sword');
});

test('cycling between two neighboring copies selects their identities and does not reuse ingredients', () => {
  const session = sessionWith([piece('shield', 'shield-a', 0, 1), piece('shield', 'shield-b', 3, 1),
    piece('refined-iron', 'iron', 2, 1)]);
  assert.equal(getIronFusionChoices(session.board.items, 'iron').length, 2);
  assert.equal(getReadyFusions(session.board.items)[0].targetId, 'shield-a');
  session.board.move('item', 'iron', 2, 1);
  assert.equal(getReadyFusions(session.board.items)[0].targetId, 'shield-b');
  session.board.items.push(piece('refined-iron', 'iron-b', 2, 2));
  const ready = getReadyFusions(session.board.items);
  assert.equal(ready.length, 2);
  const ids = ready.flatMap(fusion => [fusion.targetId, ...fusion.consumedIds]);
  assert.equal(new Set(ids).size, ids.length);
});
