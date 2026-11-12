import test from 'node:test';
import assert from 'node:assert/strict';
import { allItems, shopCatalog } from '../src/data/shopCatalog.js';
import { generalItems } from '../src/data/generalItems.js';
import { weaponItems } from '../src/data/weaponItems.js';
import { getItemRarity, itemRarityIds, itemRarities, getShopDistribution, rollShopItem,
  getShopRarityChances } from '../src/data/itemRarities.js';
import { seededRandom } from '../src/utils/seededRandom.js';
import { getItemDetails } from '../src/utils/itemDetails.js';
import ShoppingSession from '../src/systems/ShoppingSession.js';

test('todos os 34 itens têm raridade explícita; dourado é épico e nenhum item é lendário', () => {
  assert.deepEqual(Object.keys(itemRarityIds).sort(), allItems.map(item => item.id).sort());
  for (const item of [...allItems, ...generalItems, ...weaponItems]) {
    assert.ok(itemRarities[item.rarity], item.id);
    assert.equal(item.rarity, getItemRarity(item).id);
    assert.equal(getItemDetails(item).rarity.id, item.rarity);
    assert.equal(getItemDetails({ ...item, catalogId: item.id, id: 'copy#2', rotation: 90 }).rarity.id, item.rarity);
  }
  assert.equal(getItemRarity('sword').id, 'common');
  assert.equal(getItemRarity('fire-stone').id, 'rare');
  assert.equal(getItemRarity('bow').id, 'rare');
  assert.equal(getItemRarity('iron-armor').id, 'rare');
  assert.equal(getItemRarity('golden-crystal').id, 'epic');
  assert.ok(allItems.every(item => item.rarity !== 'legendary'));
});

test('chances somam 100%, são totais por raridade e avançam nas rodadas corretas', () => {
  for (const [round, expected] of [[1, [0.7, 0.25, 0.05]], [2, [0.7, 0.25, 0.05]],
    [3, [0.55, 0.3, 0.15]], [5, [0.55, 0.3, 0.15]], [6, [0.4, 0.35, 0.25]], [11, [0.4, 0.35, 0.25]]]) {
    const distribution = getShopDistribution(allItems, round);
    const chances = getShopRarityChances(round);
    for (const [index, rarity] of ['common', 'uncommon', 'rare'].entries()) {
      const total = distribution.filter(entry => entry.item.rarity === rarity).reduce((sum, entry) => sum + entry.chance, 0);
      assert.ok(Math.abs(total - expected[index]) < 1e-12);
      assert.equal(chances[rarity], expected[index]);
    }
    assert.ok(distribution.every(entry => entry.item.acquisition !== 'fusion'));
    assert.equal(distribution.at(-1).end, 1);
    assert.equal(rollShopItem(distribution, 0).id, distribution[0].item.id);
    assert.equal(rollShopItem(distribution, 1).id, distribution.at(-1).item.id);
    for (const entry of distribution) assert.equal(rollShopItem(distribution, (entry.start + entry.end) / 2).id, entry.item.id);
  }
});

test('sorteio real da loja segue as frequências configuradas e nunca vende resultados de fusão', () => {
  for (const round of [1, 4, 8]) {
    const session = new ShoppingSession({ random: seededRandom(88123 + round) });
    session.round = round;
    const counts = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    for (let i = 0; i < 2000; i++) {
      session.refreshOffers();
      for (const offer of session.offers) {
        assert.ok(shopCatalog.some(item => item.id === offer.id));
        counts[getItemRarity(offer).id]++;
      }
    }
    const expected = getShopRarityChances(round);
    for (const rarity of Object.keys(counts)) assert.ok(Math.abs(counts[rarity] / 12000 - expected[rarity]) < 0.02,
      `${round}/${rarity}: ${counts[rarity]}`);
  }
});

test('loja inicial garantida e ofertas fixadas permanecem; renovar cobra uma vez', () => {
  const session = new ShoppingSession({ random: seededRandom(121) });
  assert.deepEqual(session.offers.map(offer => offer.id), ['traveler-bag', 'sword', 'shield', 'potion', 'refined-iron', 'long-bag']);
  assert.equal(session.toggleOfferLock(1), null);
  const locked = structuredClone(session.offers[1]);
  const gold = session.gold;
  assert.equal(session.reroll(), null);
  assert.equal(session.gold, gold - 1);
  assert.deepEqual(session.offers[1], locked);
  session.round = 6;
  session.refreshOffers();
  assert.deepEqual(session.offers[1], locked);
});

test('fusões atualizam os metadados da raridade, preservando identidade e preço', () => {
  const session = new ShoppingSession();
  session.buy('traveler-bag');session.buy('sword');session.buy('refined-iron');
  session.board.move('bag', 'traveler-bag', 0, 0);
  session.board.move('item', 'sword', 0, 0);session.board.move('item', 'refined-iron', 1, 1);
  const sword = session.board.items.find(item => item.id === 'sword');
  assert.equal(sword.rarity, 'common');
  session.beginBattle();session.finishBattle('victory');
  assert.equal(sword.id, 'sword');
  assert.equal(sword.catalogId, 'iron-sword');
  assert.equal(sword.rarity, 'rare');
  assert.equal(getItemDetails(sword).rarity.id, 'rare');
  assert.equal(sword.price, 6);
});

test('catálogo de classe restrito redistribui chances sem itens fora do conjunto', () => {
  const onlyCommon = shopCatalog.filter(item => item.rarity === 'common');
  const distribution = getShopDistribution(onlyCommon, 8);
  assert.ok(Math.abs(distribution.reduce((sum, entry) => sum + entry.chance, 0) - 1) < 1e-12);
  assert.ok(distribution.every(entry => entry.item.rarity === 'common'));
});
