import test from 'node:test';
import assert from 'node:assert/strict';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import { createOpponent } from '../src/data/opponents.js';
import { getStarTargets } from '../src/utils/itemStars.js';
import { opponentBudget, roundIncome } from '../src/data/economy.js';
import { getCombatItem } from '../src/data/combatItems.js';

test('primeira loja permite comprar um conjunto completo com os 14 de ouro iniciais', () => {
  const session = new ShoppingSession();
  for (const id of ['traveler-bag', 'sword', 'shield', 'potion']) assert.equal(session.buy(id), null);
  assert.equal(session.gold, 1);
  assert.equal(session.board.bags.length, 1);
  assert.equal(session.board.items.length, 3);
  assert.ok(session.buy('potion'));
  assert.ok(session.buy('refined-iron'));
  assert.equal(session.gold, 1);
  assert.equal(session.board.items.length, 3);
});

test('renovar custa um ouro, preserva ofertas fixadas e repõe espaços vendidos', () => {
  const session = new ShoppingSession({ random: () => 0.25 });
  session.toggleOfferLock(2);
  session.buy('sword');
  const locked = { ...session.offers[2] };
  const gold = session.gold;
  assert.equal(session.reroll(), null);
  assert.equal(session.gold, gold - 1);
  assert.deepEqual(session.offers[2], locked);
  assert.equal(session.offers[1].sold, false);
  assert.equal(session.buy(session.offers[1].id, 1), null);
  assert.equal(session.reroll(), null);
  assert.equal(session.buy(session.offers[1].id, 1), null);
  assert.equal(new Set(session.board.items.map(item => item.id)).size, session.board.items.length);
});

test('renovar sem ouro ou com todas as ofertas fixadas não altera estoque nem cobra', () => {
  const session = new ShoppingSession();
  for (let i = 0; i < session.offers.length; i++) session.toggleOfferLock(i);
  const before = JSON.stringify(session.offers);
  assert.ok(session.reroll());
  assert.equal(session.gold, 14);
  assert.equal(JSON.stringify(session.offers), before);
  session.toggleOfferLock(0);
  session.gold = 0;
  assert.ok(session.reroll());
  assert.equal(session.gold, 0);
  assert.equal(session.offers[0].sold, false);
});

test('renda é paga uma única vez após resultado e ofertas fixadas atravessam rodadas', () => {
  const session = new ShoppingSession({ random: () => 0.5 });
  session.toggleOfferLock(0);
  for (const result of ['victory', 'defeat', 'draw']) {
    const gold = session.gold;
    session.beginBattle();
    const report = session.finishBattle(result);
    assert.equal(report.income, roundIncome(session.round));
    assert.equal(session.gold, gold + report.income);
    assert.equal(session.offers[0].id, 'traveler-bag');
    assert.equal(session.offers[0].locked, true);
    assert.equal(session.finishBattle(result), null);
    assert.equal(session.gold, gold + report.income);
  }
  assert.equal(roundIncome(2), 8);
  assert.equal(roundIncome(3), 9);
  assert.equal(roundIncome(20), 13);
});

test('venda paga metade do preço, protege mochilas ocupadas e não permite vender duas vezes', () => {
  const session = new ShoppingSession();
  session.buy('traveler-bag'); session.buy('sword');
  session.board.move('bag', 'traveler-bag', 0, 0);
  session.board.move('item', 'sword', 0, 0);
  assert.ok(session.sell('bag', 'traveler-bag'));
  assert.equal(session.gold, 7);
  assert.equal(session.sell('item', 'sword'), null);
  assert.equal(session.gold, 8);
  assert.ok(session.sell('item', 'sword'));
  assert.equal(session.gold, 8);
  assert.equal(session.sell('bag', 'traveler-bag'), null);
  assert.equal(session.gold, 10);
  assert.equal(session.board.bags.length, 0);
});

test('fusão atualiza o preço de venda sem gerar ouro gratuitamente', () => {
  const session = new ShoppingSession();
  for (const id of ['traveler-bag', 'sword', 'refined-iron']) session.buy(id);
  session.board.move('bag', 'traveler-bag', 0, 0);
  session.board.move('item', 'sword', 0, 0);
  session.board.move('item', 'refined-iron', 1, 1);
  session.beginBattle();
  assert.equal(session.finishBattle('victory').fusions, 1);
  assert.equal(session.board.items[0].price, 6);
  const gold = session.gold;
  assert.equal(session.sell('item', 'sword'), null);
  assert.equal(session.gold, gold + 3);
});

test('comprar, vender, renovar e fixar ficam bloqueados durante a batalha e após o fim', () => {
  const session = new ShoppingSession();
  session.buy('sword');
  session.beginBattle();
  const gold = session.gold;
  assert.ok(session.buy('shield'));
  assert.ok(session.sell('item', 'sword'));
  assert.ok(session.reroll());
  assert.ok(session.toggleOfferLock(0));
  assert.equal(session.gold, gold);
  session.finishBattle('defeat');
  for (let i = 0; i < 3; i++) { session.beginBattle(); session.finishBattle('defeat'); }
  assert.equal(session.runResult, 'defeat');
  const finalGold = session.gold;
  assert.ok(session.sell('item', 'sword'));
  assert.ok(session.reroll());
  assert.equal(session.gold, finalGold);
});

test('adversários respeitam orçamento, usam estrelas ativas e não empilham armas sem estamina', () => {
  for (let round = 1; round <= 11; round++) {
    const opponent = createOpponent(round);
    const pieces = [...opponent.board.bags, ...opponent.board.items];
    assert.equal(opponent.spent, pieces.reduce((sum, item) => sum + item.price, 0));
    assert.ok(opponent.spent <= opponentBudget(round));
    assert.ok(opponent.board.items.some(item => getCombatItem(item).damage));
    for (const iron of opponent.board.items.filter(item => item.catalogId === 'refined-iron')) {
      assert.ok(getStarTargets(iron, opponent.board.items).some(item =>
        getCombatItem(item).damage || getCombatItem(item).blockChance || getCombatItem(item).healing));
    }
    const weapons = opponent.board.items.filter(item => getCombatItem(item).damage);
    assert.ok(weapons.length <= 3);
  }
});
