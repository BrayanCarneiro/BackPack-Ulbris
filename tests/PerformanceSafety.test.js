import test from 'node:test';
import assert from 'node:assert/strict';
import { getFootprintCells, rotateFootprint } from '../src/utils/rotation.js';
import { clonePlainData } from '../src/utils/cloneData.js';
import { formatNumber, formatCompactNumber } from '../src/utils/formatNumber.js';
import { createOpponent } from '../src/systems/OpponentPlanner.js';
import { allItems } from '../src/data/shopCatalog.js';
import { getShopPresentation } from '../src/data/shopPresentation.js';

test('cached rectangular footprints cannot be changed by another piece or rotation', () => {
  const piece = { width: 2, height: 3 };
  const cells = getFootprintCells(piece);
  assert.throws(() => { cells[0].x = 99; }, TypeError);
  assert.throws(() => cells.pop(), TypeError);
  assert.equal(getFootprintCells(rotateFootprint(piece, 1)).length, 6);
  assert.deepEqual(getFootprintCells(piece)[0], { x: 0, y: 0 });
  for (const item of allItems) assert.equal(getFootprintCells(item).length, item.cells?.length ?? item.width * item.height);
});

test('older-browser snapshot fallback preserves shapes, null, undefined and shared references without sharing state', () => {
  const shape = [{ x: 0, y: 0 }];
  const source = { items: [{ id: 'a', cells: shape, x: null, result: undefined }, { id: 'b', cells: shape }], value: 1.2 };
  source.self = source;
  const copy = clonePlainData(source);
  assert.deepEqual(copy, source);
  assert.equal(copy.self, copy);
  assert.equal(copy.items[0].cells, copy.items[1].cells);
  copy.items[0].cells[0].x = 99;
  assert.equal(source.items[0].cells[0].x, 0);
});

test('shared number formatters preserve Portuguese HUD values for every item statistic', () => {
  for (const value of [0, 1, -1, 1.005, 12.3456, 10000.55, 0.1, 99.9999]) {
    assert.equal(formatNumber(value), value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
    assert.equal(formatCompactNumber(value), value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
  }
});

test('lightweight opponent snapshot keeps the same equipment and independent state', () => {
  const full = createOpponent(11, 28);
  const light = createOpponent(11, 28, { includeHistory: false });
  const { history, ...expected } = full;
  assert.deepEqual(light, expected);
  assert.equal('history' in light, false);
  light.board.items[0].x = 99;
  assert.deepEqual(createOpponent(11, 28).board, full.board);
});

test('every item copy retains its catalog category, summary and color', () => {
  for (const item of allItems) assert.deepEqual(getShopPresentation({ ...item, id: `${item.id}#2`, catalogId: item.id }), getShopPresentation(item));
});
