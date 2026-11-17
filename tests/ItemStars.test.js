import test from 'node:test';
import assert from 'node:assert/strict';
import { getStarCells, getStarTargets, getActiveStarCells } from '../src/utils/itemStars.js';
import { rotateFootprint } from '../src/utils/rotation.js';

test('feedback do ferro aceita armas e poções nas estrelas, mas não itens sem ativação', () => {
  const iron = { id: 'iron', catalogId: 'refined-iron', x: 2, y: 2, width: 1, height: 1 };
  const sword = { id: 'weapon', catalogId: 'sword', x: 1, y: 1, width: 1, height: 3 };
  const crystal = { id: 'crystal', catalogId: 'vital-crystal', x: 3, y: 2, width: 1, height: 1 };
  assert.deepEqual(getActiveStarCells(iron, [iron, sword, crystal]), [{ x: 1, y: 2 }]);
  assert.deepEqual(getActiveStarCells(iron, [sword, { ...crystal, catalogId: 'potion' }]),
    [{ x: 1, y: 2 }, { x: 3, y: 2 }]);
  assert.deepEqual(getActiveStarCells({ ...iron, x: null, y: null }, [sword]), []);
});

test('feedback respeita tipo de alvo, rotação e espaços vazios de formatos irregulares', () => {
  const support = { id: 'support', catalogId: 'whetstone', x: 2, y: 2, width: 1, height: 1, rotation: 90 };
  const armor = { id: 'armor', catalogId: 'shield', x: 2, y: 1, width: 1, height: 1 };
  const bow = { id: 'bow', catalogId: 'bow', x: 2, y: 3, width: 2, height: 2,
    cells: [{ x: 1, y: 0 }, { x: 0, y: 1 }] };
  assert.deepEqual(getActiveStarCells(support, [armor, bow]), []);
  assert.deepEqual(getActiveStarCells(support, [armor, { ...bow, cells: undefined }]), [{ x: 2, y: 3 }]);
  assert.deepEqual(getActiveStarCells({ ...support, catalogId: 'leather-chestplate' }, [armor, bow]), [{ x: 2, y: 1 }]);
});

test('estrelas são os slots laterais e aceitam qualquer célula de um item de vários slots', () => {
  const iron = { id: 'iron', x: 2, y: 2, width: 1, height: 1 };
  assert.deepEqual(getStarCells(iron), [{ x: 1, y: 2 }, { x: 3, y: 2 }]);
  const items = [iron,
    { id: 'left', x: 1, y: 0, width: 1, height: 3 },
    { id: 'right', x: 3, y: 2, width: 3, height: 1 },
    { id: 'above', x: 2, y: 1, width: 1, height: 1 },
    { id: 'stored', x: null, y: null, width: 1, height: 1 }];
  assert.deepEqual(getStarTargets(iron, items).map(item => item.id), ['left', 'right']);
  assert.deepEqual(getStarTargets({ ...iron, x: null }, items), []);
});

test('cada giro de 90 graus alterna estrelas horizontais e verticais, inclusive na prévia', () => {
  const iron = { id: 'iron', x: 2, y: 2, width: 1, height: 1 };
  const horizontal = [{ x: 1, y: 2 }, { x: 3, y: 2 }];
  const vertical = [{ x: 2, y: 1 }, { x: 2, y: 3 }];
  for (let turns = 0; turns <= 4; turns += 1) {
    assert.deepEqual(getStarCells(rotateFootprint(iron, turns)), turns % 2 ? vertical : horizontal);
  }
  const alreadyRotated = rotateFootprint(iron, 1);
  assert.deepEqual(getStarCells(rotateFootprint(alreadyRotated, 1)), horizontal);
  assert.equal(iron.rotation, undefined);
});

test('ferro girado afeta apenas itens nas estrelas acima e abaixo', () => {
  const iron = { id: 'iron', x: 2, y: 2, width: 1, height: 1, rotation: 90 };
  const items = [
    { id: 'above', x: 1, y: 1, width: 3, height: 1 },
    { id: 'below', x: 2, y: 3, width: 1, height: 3 },
    { id: 'left', x: 1, y: 2, width: 1, height: 1 },
    { id: 'right', x: 3, y: 2, width: 1, height: 1 },
  ];
  assert.deepEqual(getStarTargets(iron, items).map(item => item.id), ['above', 'below']);
});
