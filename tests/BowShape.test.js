import test from 'node:test';
import assert from 'node:assert/strict';
import { allItems } from '../src/data/shopCatalog.js';
import { getFootprintCells, rotateFootprint, occupiesCell } from '../src/utils/rotation.js';
import { getStarTargets } from '../src/utils/itemStars.js';
import PackingBoard from '../src/systems/PackingBoard.js';
import Combat from '../src/systems/Combat.js';

const bow = () => ({ ...allItems.find(item => item.id === 'bow'), x: 0, y: 0 });
const potion = () => ({ id: 'potion', kind: 'item', x: 1, y: 1, width: 1, height: 1 });
const board = (items, bags = [{ id: 'bag', x: 0, y: 0, width: 4, height: 4 }]) =>
  new PackingBoard({ columns: 8, rows: 8, bags, items });

test('arco ocupa cinco espaços em C e mantém o formato após quatro giros', () => {
  const original = bow();
  const before = JSON.stringify(original);
  let rotated = original;
  for (let turn = 0; turn < 4; turn++) {
    assert.equal(getFootprintCells(rotated).length, 5);
    assert.equal(occupiesCell(rotated, turn === 2 ? 0 : 1, turn === 3 ? 0 : 1), false);
    rotated = rotateFootprint(rotated, 1);
  }
  assert.deepEqual(rotated.cells, original.cells);
  assert.deepEqual([rotated.width, rotated.height, rotated.rotation], [2, 3, 0]);
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(rotateFootprint(original, -1).cells, rotateFootprint(original, 3).cells);
});

test('outro item cabe no vazio do arco; células preenchidas bloqueiam e rotação inválida é desfeita', () => {
  const input = board([{ ...bow(), x: null, y: null }, potion()]);
  assert.equal(input.move('item', 'bow', 0, 0), null);
  assert.equal(input.getPlacementError('item', 'potion', 0, 1), 'Esse espaço já tem um item.');
  assert.equal(input.move('item', 'bow', 0, 0, 1), null);
  const before = JSON.stringify(input.items);
  assert.equal(input.move('item', 'bow', 0, 0, 1), 'Esse espaço já tem um item.');
  assert.equal(JSON.stringify(input.items), before);
  assert.equal(input.store('item', 'bow', 1), null);
  assert.equal(input.items[0].rotation, 180);
});

test('somente os cinco espaços preenchidos precisam de mochila; mochila no vazio fica livre', () => {
  const bags = [
    { id: 'spine', x: 0, y: 0, width: 1, height: 3 },
    { id: 'top', x: 1, y: 0, width: 1, height: 1 },
    { id: 'bottom', x: 1, y: 2, width: 1, height: 1 },
  ];
  const input = board([bow()], bags);
  assert.equal(input.hasSupport(input.items[0]), true);
  assert.equal(input.getPlacementError('item', 'bow', 0, 0), null);
  const holeBag = { id: 'hole', x: 1, y: 1, width: 1, height: 1 };
  input.bags.push(holeBag);
  assert.equal(input.bagHasItems(holeBag), false);
  assert.equal(input.store('bag', 'hole'), null);
  assert.equal(input.store('bag', 'spine'), 'Retire todos os itens da mochila antes de guardá-la.');
  input.bags = input.bags.filter(bag => bag.id !== 'top');
  assert.equal(input.hasSupport(input.items[0]), false);
});

test('estrelas apontando para o vazio não concedem bônus ao arco', () => {
  for (const y of [0, 1, 2]) {
    const stone = { id: 'whetstone', x: 2, y, width: 1, height: 1 };
    assert.equal(getStarTargets(stone, [bow()]).length, y === 1 ? 0 : 1);
    const combat = new Combat(board([bow(), stone]), board([]));
    assert.equal(combat.fighters.player.weapons[0].damage, y === 1 ? 3.4 : 3.7);
  }
});
