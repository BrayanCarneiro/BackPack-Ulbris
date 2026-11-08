import test from 'node:test';
import assert from 'node:assert/strict';
import { getStarCells, getStarTargets } from '../src/utils/itemStars.js';
import { rotateFootprint } from '../src/utils/rotation.js';

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
