import test from 'node:test';
import assert from 'node:assert/strict';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import { allItems, getShopCatalog } from '../src/data/shopCatalog.js';
import { getReadyFusions, getFusionProgress } from '../src/utils/itemFusions.js';
import { getItemDetails } from '../src/utils/itemDetails.js';
import { getShopDistribution, getItemRarity, rollShopItem } from '../src/data/itemRarities.js';
import { seededRandom } from '../src/utils/seededRandom.js';

const piece = (id, x, y, extra = {}) => ({ ...allItems.find(item => item.id === id), catalogId: id, x, y, ...extra });
function setup() {
  const session = new ShoppingSession({ classId: 'arthur', campaign: false });
  session.board.bags = [piece('knight-bag', 0, 0, { width: 8, height: 8 })];
  session.board.items = [piece('knight-greatsword', 0, 0), piece('golden-crystal', 2, 0)];
  return session;
}
function fight(session, result = 'victory') {
  assert.equal(session.beginBattle(), true);
  return session.finishBattle(result);
}

test('Juramento exige duas batalhas anteriores com a espada; cristal só é consumido na fusão posterior', () => {
  const session = setup();
  const sword = session.board.items[0];
  for (let count = 0; count < 2; count++) {
    assert.equal(getReadyFusions(session.board.items, 'arthur').length, 0);
    assert.deepEqual(getFusionProgress(session.board.items, null, 'arthur')[0].oath, { count, required: 2 });
    assert.equal(fight(session, count ? 'draw' : 'defeat').fusions, 0);
    assert.equal(sword.oathBattles, count + 1);
    assert.equal(session.board.items.length, 2);
    assert.equal(sword.catalogId, 'knight-greatsword');
  }
  assert.equal(getReadyFusions(session.board.items, 'arthur')[0].resultId, 'excalibur');
  assert.equal(fight(session).fusions, 1);
  assert.equal(sword.catalogId, 'excalibur');
  assert.equal('oathBattles' in sword, false);
  assert.equal(session.board.items.length, 1);
});

test('cancelamento, relatório inválido, relatório duplicado e reserva não avançam o Juramento', () => {
  const session = setup();
  const sword = session.board.items[0];
  session.beginBattle();
  assert.equal(session.finishBattle('invalid'), null);
  session.cancelBattle();
  assert.equal(session.finishBattle('victory'), null);
  assert.equal(sword.oathBattles, undefined);
  fight(session);
  assert.equal(session.finishBattle('victory'), null);
  assert.equal(sword.oathBattles, 1);
  session.board.store('item', sword.id);
  fight(session);
  assert.equal(sword.oathBattles, 1);
  session.board.move('item', sword.id, 0, 0);
  fight(session);
  assert.equal(sword.oathBattles, 2);
});

test('Juramento pertence a cada espada e pode ser completado sem o cristal', () => {
  const session = setup();
  session.board.items.pop();
  const sword = session.board.items[0];
  fight(session);
  session.board.items.push(piece('knight-greatsword', 4, 0, { id: 'second' }));
  fight(session);
  assert.equal(sword.oathBattles, 2);
  assert.equal(session.board.items[1].oathBattles, 1);
  assert.ok(getItemDetails(sword).effectRows.some(row => row.label === 'Juramento' && row.value === '2/2 batalhas'));
  assert.ok(getItemDetails(session.board.items[1]).effectRows.some(row => row.label === 'Juramento' && row.value === '1/2 batalhas'));
  fight(session);
  assert.equal(sword.oathBattles, 2);
});

test('a batalha que cria a Espada Grande não conta como batalha equipada com ela', () => {
  const session = setup();
  session.board.items = [piece('iron-sword', 0, 0), piece('whetstone', 1, 0),
    piece('haste-stone', 2, 0), piece('refined-iron', 3, 0)];
  assert.equal(fight(session).fusions, 1);
  const sword = session.board.items[0];
  assert.equal(sword.catalogId, 'knight-greatsword');
  assert.equal(sword.oathBattles, undefined);
  fight(session);
  assert.equal(sword.oathBattles, 1);
});

test('Bastião é épico, começa com 10% na rodada 6 e fica mais frequente nas próximas rodadas', () => {
  const catalog = getShopCatalog('arthur');
  assert.equal(getItemRarity('bastion-chestplate').id, 'epic');
  for (const round of [1, 3, 5]) assert.equal(getShopDistribution(catalog, round).some(entry => entry.item.id === 'bastion-chestplate'), false);
  for (const [round, chance] of [[6, 0.1], [10, 0.14], [1000, 0.25]]) {
    const distribution = getShopDistribution(catalog, round);
    const bastion = distribution.find(entry => entry.item.id === 'bastion-chestplate');
    assert.ok(Math.abs(bastion.chance - chance) < 1e-12);
    assert.equal(rollShopItem(distribution, (bastion.start + bastion.end) / 2).id, 'bastion-chestplate');
  }
  assert.equal(getShopDistribution(getShopCatalog(null), 10).some(entry => entry.item.id === 'bastion-chestplate'), false);
  const session = new ShoppingSession({ classId: 'arthur', random: seededRandom(88182) });
  session.round = 6;
  let seen = 0;
  for (let i = 0; i < 2000; i++) {
    session.refreshOffers();
    seen += session.offers.filter(offer => offer.id === 'bastion-chestplate').length;
  }
  assert.ok(seen > 1080 && seen < 1320, `Esperados cerca de 1200 Bastiões em 12000 ofertas; encontrados ${seen}`);
});
