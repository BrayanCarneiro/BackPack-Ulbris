import test from 'node:test';
import assert from 'node:assert/strict';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import { shopCatalog } from '../src/data/shopCatalog.js';

test('compras cobram preços e aceitam cópias disponíveis sem alterar catálogo ou outras partidas', () => {
  const session = new ShoppingSession();
  session.gold = shopCatalog.reduce((sum, item) => sum + item.price * 2, 0);
  session.offers = shopCatalog.flatMap(item => Array.from({ length: 2 }, () => ({ id: item.id, sold: false, locked: false })));
  const original = JSON.stringify(shopCatalog);
  for (const offer of shopCatalog) {
    assert.ok(offer.price > 0);
    assert.equal(session.buy(offer.id), null);
    assert.equal(session.buy(offer.id), null);
    assert.ok(session.owns(offer.id));
  }
  assert.equal(session.board.bags.length, 6);
  assert.equal(session.board.items.length, shopCatalog.filter(item => item.kind === 'item').length * 2);
  const pieces = [...session.board.bags, ...session.board.items];
  assert.equal(new Set(pieces.map(piece => piece.id)).size, pieces.length);
  assert.equal(session.board.move('bag', 'traveler-bag#2', 0, 0), null);
  assert.equal(session.board.bags.find(piece => piece.id === 'traveler-bag').x, null);
  session.board.store('bag', 'traveler-bag#2');
  assert.ok([...session.board.bags, ...session.board.items].every((piece) => piece.x === null));
  assert.equal(session.board.store('item', 'sword', 1), null);
  assert.equal(JSON.stringify(shopCatalog), original);
  assert.equal(new ShoppingSession().board.bags.length, 0);
  assert.ok(session.buy('missing'));
});

function recipeSession() {
  const session = new ShoppingSession();
  session.gold = 100;
  session.offers = shopCatalog.flatMap(item => Array.from({ length: 3 }, () => ({ id: item.id, sold: false, locked: false })));
  for (const id of ['traveler-bag', 'sword', 'refined-iron']) session.buy(id);
  session.board.move('bag', 'traveler-bag', 0, 0);
  session.board.move('item', 'sword', 0, 0);
  session.board.move('item', 'refined-iron', 1, 1);
  return session;
}

test('fusão só ocorre depois de uma batalha completa e preserva células e orientação da espada', () => {
  const session = recipeSession();
  const sword = session.board.items.find(item => item.id === 'sword');
  session.beginBattle();
  assert.equal(sword.catalogId, 'sword');
  const report = session.finishBattle('victory');
  assert.equal(report.fusions, 1);
  assert.equal(session.round, 2);
  assert.equal(session.board.items.length, 1);
  assert.equal(sword.catalogId, 'iron-sword');
  assert.equal(sword.label, 'Espada de ferro');
  assert.deepEqual([sword.x, sword.y, sword.width, sword.height, sword.rotation], [0, 0, 1, 3, 0]);
  assert.equal(session.finishBattle('victory'), null);
  assert.equal(session.round, 2);
  session.offers.push({ id: 'sword', sold: false, locked: false });
  assert.equal(session.buy('sword'), null);
  assert.equal(session.board.items[1].id, 'sword#2');
  assert.equal(session.board.items[1].catalogId, 'sword');
});

test('cancelar a batalha, ferro na reserva e adjacência vertical não fundem os itens', () => {
  const cancelled = recipeSession();
  cancelled.beginBattle();
  cancelled.cancelBattle();
  assert.equal(cancelled.finishBattle('victory'), null);
  assert.equal(cancelled.board.items.length, 2);
  const stored = recipeSession();
  stored.board.store('item', 'refined-iron');
  stored.beginBattle();
  assert.equal(stored.finishBattle('defeat').fusions, 0);
  const vertical = recipeSession();
  vertical.board.move('item', 'refined-iron', 0, 3);
  vertical.beginBattle();
  assert.equal(vertical.finishBattle('draw').fusions, 0);
});

test('fusão de uma espada girada mantém sua orientação e a posição dos itens restantes', () => {
  const session = recipeSession();
  session.board.store('item', 'refined-iron');
  assert.equal(session.board.move('item', 'sword', 0, 1, 1), null);
  assert.equal(session.board.move('item', 'refined-iron', 3, 1), null);
  session.buy('potion');
  session.board.move('item', 'potion', 0, 0);
  const potion = { ...session.board.items.find(item => item.id === 'potion') };
  session.beginBattle();
  assert.equal(session.finishBattle('victory').fusions, 1);
  const sword = session.board.items.find(item => item.catalogId === 'iron-sword');
  assert.deepEqual([sword.x, sword.y, sword.width, sword.height, sword.rotation], [0, 1, 3, 1, 90]);
  assert.deepEqual(session.board.items.find(item => item.id === 'potion'), potion);
});

test('ferro girado permite fundir espada acima dele após a batalha', () => {
  const session = recipeSession();
  assert.equal(session.board.move('item', 'refined-iron', 0, 3, 1), null);
  session.beginBattle();
  assert.equal(session.finishBattle('victory').fusions, 1);
  assert.equal(session.board.items.find(item => item.id === 'sword').catalogId, 'iron-sword');
});

test('dois ferros não consomem a mesma espada e receitas repetidas fundem pares distintos', () => {
  const session = recipeSession();
  session.board.move('item', 'sword', 1, 0);
  session.board.move('item', 'refined-iron', 0, 1);
  session.buy('refined-iron');
  session.board.move('item', 'refined-iron#2', 2, 1);
  session.beginBattle();
  assert.equal(session.finishBattle('defeat').fusions, 1);
  assert.equal(session.board.items.filter(item => item.catalogId === 'refined-iron').length, 1);
  const two = recipeSession();
  two.buy('sword'); two.buy('refined-iron');
  two.board.move('item', 'sword#2', 3, 0);
  two.board.move('item', 'refined-iron#2', 2, 1);
  two.beginBattle();
  assert.equal(two.finishBattle('draw').fusions, 2);
  assert.equal(two.board.items.filter(item => item.catalogId === 'iron-sword').length, 2);
});

test('conclusão exige mochila e equipamento posicionados e mantém os itens da reserva', () => {
  const session = new ShoppingSession();
  assert.ok(session.getCompletionError());
  session.buy('traveler-bag');
  session.buy('sword');
  session.buy('potion');
  assert.ok(session.getCompletionError());
  assert.equal(session.board.move('bag', 'traveler-bag', 0, 0), null);
  assert.ok(session.getCompletionError());
  assert.equal(session.board.move('item', 'sword', 0, 0), null);
  assert.equal(session.getCompletionError(), null);
  assert.equal(session.board.items.find((item) => item.id === 'potion').x, null);
  session.board.store('item', 'sword');
  assert.ok(session.getCompletionError());
});
