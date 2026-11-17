import test from 'node:test';
import assert from 'node:assert/strict';
import { allItems } from '../src/data/shopCatalog.js';
import { filterCatalog, getCatalogType } from '../src/utils/catalogFilters.js';

test('tipo agrupa armaduras antes de armas e separa cristais com defesa das peças de armadura', () => {
  assert.equal(getCatalogType(allItems.find(item => item.id === 'armored-crystal')), 'crystal');
  assert.equal(getCatalogType(allItems.find(item => item.id === 'iron-shield')), 'armor');
  const result = filterCatalog(allItems);
  assert.equal(result.length, 41);
  assert.ok(result.slice(0, 9).every(item => getCatalogType(item) === 'armor'));
  assert.ok(result.slice(9, 19).every(item => getCatalogType(item) === 'weapon'));
  const counts = Object.fromEntries(['armor', 'weapon', 'potion', 'stone', 'crystal', 'bag', 'material']
    .map(type => [type, filterCatalog(allItems, { type }).length]));
  assert.deepEqual(counts, { armor: 9, weapon: 10, potion: 4, stone: 5, crystal: 8, bag: 4, material: 1 });
});

test('tipo e raridade combinam, incluindo resultados de fusão e categoria sem itens', () => {
  assert.deepEqual(filterCatalog(allItems, { type: 'armor', rarity: 'rare' }).map(item => item.id),
    ['iron-armor', 'iron-helmet', 'commander-helmet', 'iron-shield']);
  assert.ok(filterCatalog(allItems, { type: 'armor', rarity: 'epic' }).some(item => item.id === 'bastion-chestplate'));
  assert.deepEqual(filterCatalog(allItems, { type: 'crystal', rarity: 'epic' }).map(item => item.id), ['golden-crystal']);
  assert.deepEqual(filterCatalog(allItems, { rarity: 'legendary' }).map(item => item.id), ['excalibur']);
});

test('ordem alfabética trata acentos em português e pode ser invertida', () => {
  const items = ['Zebra', 'Épico', 'Arco', 'Água', 'Branco'].map((name, index) => ({ id: `test-${index}`, name }));
  assert.deepEqual(filterCatalog(items, { sort: 'name' }).map(item => item.name), ['Água', 'Arco', 'Branco', 'Épico', 'Zebra']);
  assert.deepEqual(filterCatalog(items, { sort: 'name', direction: 'desc' }).map(item => item.name), ['Zebra', 'Épico', 'Branco', 'Arco', 'Água']);
});

test('ordenação por raridade vai de comum a lendário sem alterar a coleção original', () => {
  const before = structuredClone(allItems);
  const result = filterCatalog(allItems, { sort: 'rarity' });
  assert.ok(result.slice(0, 8).every(item => item.rarity === 'common'));
  assert.ok(result.slice(8, 19).every(item => item.rarity === 'uncommon'));
  assert.ok(result.slice(19, 36).every(item => item.rarity === 'rare'));
  assert.ok(result.slice(36, 40).every(item => item.rarity === 'epic'));
  assert.equal(result[40].rarity, 'legendary');
  assert.deepEqual(allItems, before);
});
