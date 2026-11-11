import test from 'node:test';
import assert from 'node:assert/strict';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import Combat from '../src/systems/Combat.js';
import { shopCatalog, allItems } from '../src/data/shopCatalog.js';
import { getItemDetails } from '../src/utils/itemDetails.js';

function shieldSession() {
  const session = new ShoppingSession();
  for (const id of ['traveler-bag', 'shield', 'refined-iron']) assert.equal(session.buy(id), null);
  session.board.move('bag', 'traveler-bag', 0, 0);
  session.board.move('item', 'shield', 0, 0);
  session.board.move('item', 'refined-iron', 2, 0);
  return session;
}

test('Escudo de ferro é geral e consultável, mas só pode ser obtido por fusão', () => {
  assert.equal(shopCatalog.some(item => item.id === 'iron-shield'), false);
  assert.equal(allItems.filter(item => item.id === 'iron-shield').length, 1);
  assert.equal(getItemDetails('iron-shield').itemClass.symbol, 'G');
  for (const id of ['shield', 'refined-iron', 'iron-shield']) {
    assert.ok(getItemDetails(id).recipes.some(recipe => recipe.result === 'iron-shield'));
  }
  const session = new ShoppingSession();
  assert.ok(session.buy('iron-shield'));
  for (let i = 0; i < 40; i++) {
    session.refreshOffers();
    assert.ok(session.offers.every(offer => offer.id !== 'iron-shield'));
  }
});

test('escudo em uma estrela funde após vitória, derrota ou empate e preserva a peça', () => {
  for (const result of ['victory', 'defeat', 'draw']) {
    const session = shieldSession();
    session.board.move('item', 'shield', 0, 0, 1);
    const shield = session.board.items.find(item => item.id === 'shield');
    session.beginBattle();
    assert.equal(shield.catalogId, 'shield');
    const report = session.finishBattle(result);
    assert.equal(report.fusions, 1);
    assert.deepEqual(report.fusionNames, ['Escudo de ferro']);
    assert.equal(session.board.items.length, 1);
    assert.deepEqual([shield.id, shield.catalogId, shield.x, shield.y, shield.width, shield.height, shield.rotation],
      ['shield', 'iron-shield', 0, 0, 2, 2, 90]);
    assert.equal(shield.price, 7);
    assert.equal(session.finishBattle(result), null);
    const combat = new Combat(session.board, { bags: [], items: [] });
    assert.equal(combat.fighters.player.armor, 9);
    assert.equal(combat.fighters.player.shields[0].blockChance, 0.4);
  }
});

test('ferro girado permite fusão vertical; reserva, distância e cancelamento não fundem', () => {
  const vertical = shieldSession();
  assert.equal(vertical.board.move('item', 'refined-iron', 0, 2, 1), null);
  vertical.beginBattle();
  assert.equal(vertical.finishBattle('victory').fusions, 1);
  for (const setup of [session => session.board.store('item', 'shield'),
    session => session.board.store('item', 'refined-iron'),
    session => session.board.move('item', 'refined-iron', 3, 3)]) {
    const session = shieldSession();
    setup(session);
    session.beginBattle();
    assert.equal(session.finishBattle('victory').fusions, 0);
  }
  const cancelled = shieldSession();
  cancelled.beginBattle(); cancelled.cancelBattle();
  assert.equal(cancelled.finishBattle('victory'), null);
  assert.equal(cancelled.board.items.length, 2);
});

test('um ferro não é usado em duas receitas; dois ferros podem fundir espada e escudo', () => {
  for (const irons of [1, 2]) {
    const session = shieldSession();
    session.buy('sword');
    session.board.move('item', 'sword', 3, 0);
    if (irons === 2) {
      session.gold += 3;
      session.offers.push({ id: 'refined-iron', sold: false, locked: false });
      session.buy('refined-iron');
      session.board.move('item', 'refined-iron#2', 2, 1);
    }
    session.beginBattle();
    const report = session.finishBattle('victory');
    assert.equal(report.fusions, irons);
    assert.equal(session.board.items.find(item => item.id === 'sword').catalogId, 'iron-sword');
    assert.equal(session.board.items.find(item => item.id === 'shield').catalogId, irons === 2 ? 'iron-shield' : 'shield');
    assert.ok(session.board.items.every(item => item.catalogId !== 'refined-iron'));
  }
});
