import test from 'node:test';
import assert from 'node:assert/strict';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import Combat from '../src/systems/Combat.js';
import { allItems, shopCatalog } from '../src/data/shopCatalog.js';
import { getItemDetails } from '../src/utils/itemDetails.js';

const item = (id, x, y, extra = {}) => ({ ...allItems.find(piece => piece.id === id),
  id, catalogId: id, x, y, ...extra });
const board = items => ({ bags: [], items });
function shopping(ids) {
  const session = new ShoppingSession();
  session.gold = 100;
  session.offers = ids.map(id => ({ id, sold: false, locked: false }));
  ids.forEach(id => assert.equal(session.buy(id), null));
  session.board.bags.push({ id: 'test-bag', kind: 'bag', width: 8, height: 8, x: 0, y: 0 });
  return session;
}
function armorSession(irons = 2) {
  const session = shopping(['leather-chestplate', ...Array(irons).fill('refined-iron')]);
  assert.equal(session.board.move('item', 'leather-chestplate', 1, 0), null);
  for (let i = 0; i < irons; i++) {
    assert.equal(session.board.move('item', i ? `refined-iron#${i + 1}` : 'refined-iron',
      i % 2 ? 3 : 0, Math.floor(i / 2)), null);
  }
  return session;
}

test('evoluções de ferro são gerais, somente de fusão e mantêm tamanho e valor dos ingredientes', () => {
  for (const [id, width, height, price, armor] of [
    ['iron-helmet', 2, 1, 7, 6], ['iron-armor', 2, 3, 11, 11],
  ]) {
    const details = getItemDetails(id);
    assert.equal(details.itemClass.id, 'general');
    assert.deepEqual([details.piece.width, details.piece.height, details.piece.price], [width, height, price]);
    assert.equal(shopCatalog.some(piece => piece.id === id), false);
    assert.equal(Object.fromEntries(details.attributes)['Armadura inicial'], `+${armor}`);
    assert.ok(details.recipes.some(recipe => recipe.result === id));
  }
  const recipe = getItemDetails('iron-armor').recipes.find(recipe => recipe.result === 'iron-armor');
  assert.deepEqual(recipe.ingredients, ['leather-chestplate', 'refined-iron', 'refined-iron']);
});

test('elmo funde em qualquer resultado, preservando identidade, posição e orientação', () => {
  for (const result of ['victory', 'defeat', 'draw']) {
    for (const rotated of [false, true]) {
      const session = shopping(['leather-helmet', 'refined-iron']);
      assert.equal(session.board.move('item', 'leather-helmet', 0, 0, rotated ? 1 : 0), null);
      assert.equal(session.board.move('item', 'refined-iron', rotated ? 1 : 2, 0), null);
      const helmet = session.board.items[0];
      const before = [helmet.id, helmet.x, helmet.y, helmet.width, helmet.height, helmet.rotation];
      session.beginBattle();
      assert.equal(helmet.catalogId, 'leather-helmet');
      assert.equal(session.finishBattle(result).fusions, 1);
      assert.equal(helmet.catalogId, 'iron-helmet');
      assert.deepEqual([helmet.id, helmet.x, helmet.y, helmet.width, helmet.height, helmet.rotation], before);
      assert.equal(session.board.items.length, 1);
      assert.equal(session.finishBattle(result), null);
    }
  }
});

test('peitoral precisa de dois ferros distintos e os consome juntos apenas após batalha completa', () => {
  for (const result of ['victory', 'defeat', 'draw']) {
    const session = armorSession();
    session.beginBattle();
    assert.equal(session.board.items.length, 3);
    const report = session.finishBattle(result);
    assert.equal(report.fusions, 1);
    assert.deepEqual(report.fusionNames, ['Armadura de ferro']);
    assert.equal(session.board.items.length, 1);
    const armor = session.board.items[0];
    assert.deepEqual([armor.id, armor.catalogId, armor.x, armor.y, armor.width, armor.height],
      ['leather-chestplate', 'iron-armor', 1, 0, 2, 3]);
    assert.equal(armor.price, 11);
  }
  for (const mode of ['one-iron', 'stored-iron', 'far-iron', 'diagonal-iron', 'stored-chest', 'cancel']) {
    const session = armorSession(mode === 'one-iron' ? 1 : 2);
    if (mode === 'stored-iron') session.board.store('item', 'refined-iron#2');
    if (mode === 'far-iron') session.board.move('item', 'refined-iron#2', 7, 7);
    if (mode === 'diagonal-iron') assert.equal(session.board.move('item', 'refined-iron#2', 3, 3), null);
    if (mode === 'stored-chest') session.board.store('item', 'leather-chestplate');
    session.beginBattle();
    if (mode === 'cancel') session.cancelBattle();
    assert.equal(session.finishBattle('victory')?.fusions ?? 0, 0, mode);
    assert.equal(session.board.items.length, mode === 'one-iron' ? 2 : 3, mode);
  }
});

test('dois ferros fundem o peitoral por qualquer borda sem depender das estrelas ou da rotação', () => {
  for (let turns = 0; turns < 4; turns++) {
    for (const positions of [ [[1, 2], [4, 4]], [[2, 1], [3, 5]], [[1, 3], [1, 4]] ]) {
      const session = shopping(['leather-chestplate', 'refined-iron', 'refined-iron']);
      assert.equal(session.board.move('item', 'leather-chestplate', 2, 2), null);
      for (const [index, [x, y]] of positions.entries()) {
        const id = index ? 'refined-iron#2' : 'refined-iron';
        assert.equal(session.board.move('item', id, x, y, turns), null);
      }
      session.beginBattle();
      assert.equal(session.board.items[0].catalogId, 'leather-chestplate');
      assert.deepEqual(session.finishBattle('victory').fusionNames, ['Armadura de ferro']);
      assert.equal(session.board.items.length, 1);
      assert.deepEqual([session.board.items[0].x, session.board.items[0].y], [2, 2]);
    }
  }
});

test('fusão de peitoral aceita ferros com estrelas verticais e preserva o peitoral girado', () => {
  const session = shopping(['leather-chestplate', 'refined-iron', 'refined-iron']);
  assert.equal(session.board.move('item', 'leather-chestplate', 0, 1, 1), null);
  assert.equal(session.board.move('item', 'refined-iron', 0, 0, 1), null);
  assert.equal(session.board.move('item', 'refined-iron#2', 2, 3, 1), null);
  session.beginBattle();
  assert.equal(session.finishBattle('victory').fusions, 1);
  const armor = session.board.items[0];
  assert.deepEqual([armor.catalogId, armor.x, armor.y, armor.width, armor.height, armor.rotation],
    ['iron-armor', 0, 1, 3, 2, 90]);
});

test('ferros excedentes não são consumidos e duas receitas não podem compartilhar ingrediente', () => {
  const surplus = armorSession(3);
  surplus.beginBattle();
  assert.equal(surplus.finishBattle('victory').fusions, 1);
  assert.equal(surplus.board.items.filter(piece => piece.catalogId === 'refined-iron').length, 1);
  const shared = shopping(['leather-chestplate', 'leather-chestplate', 'refined-iron', 'refined-iron']);
  for (const [id, x, y] of [['leather-chestplate', 0, 0], ['leather-chestplate#2', 3, 0],
    ['refined-iron', 2, 0], ['refined-iron#2', 2, 1]]) {
    assert.equal(shared.board.move('item', id, x, y), null);
  }
  shared.beginBattle();
  assert.equal(shared.finishBattle('victory').fusions, 1);
  assert.equal(shared.board.items.filter(piece => piece.catalogId === 'iron-armor').length, 1);
  assert.equal(shared.board.items.filter(piece => piece.catalogId === 'leather-chestplate').length, 1);
});

test('receita incompleta não reserva ferro que pode participar de outra fusão', () => {
  const session = shopping(['leather-chestplate', 'leather-helmet', 'refined-iron']);
  session.board.move('item', 'leather-chestplate', 0, 0);
  session.board.move('item', 'leather-helmet', 3, 0);
  session.board.move('item', 'refined-iron', 2, 0);
  session.beginBattle();
  assert.deepEqual(session.finishBattle('victory').fusionNames, ['Elmo de ferro']);
});

test('elmo de ferro reduz atordoamento em 45% e dano crítico em 30%', () => {
  const combat = new Combat(board([item('battle-axe', 0, 0)]),
    board([item('iron-helmet', 0, 0), item('sword', 2, 0)]), { random: () => 0 });
  const effect = combat.applyWeaponEffects({ side: 'player', target: 'enemy', itemId: 'battle-axe', hit: true }, 1)[0];
  assert.equal(effect.seconds, 0.55);
  assert.equal(combat.fighters.enemy.stunnedUntil, 1.55);
  const hit = combat.applyAttack({ target: 'enemy', hit: true, critical: true, damage: 10 });
  assert.equal(hit.damage, 7);
  assert.equal(hit.armorDamage, 6);
  assert.equal(hit.healthDamage, 1);
});

test('armadura de ferro bloqueia dois debuffs e gera três por armadura nas estrelas a cada 5,9s', () => {
  const combat = new Combat(board([item('flaming-daggers', 0, 0)]),
    board([item('iron-armor', 2, 2), item('iron-helmet', 0, 2), item('shield', 4, 2)]), { random: () => 0 });
  const enemy = combat.fighters.enemy;
  assert.equal(enemy.armor, 22);
  assert.equal(enemy.resistance, 2);
  const attack = { side: 'player', target: 'enemy', itemId: 'flaming-daggers', hit: true, blocked: 0, damage: 1 };
  assert.equal(combat.applyWeaponEffects(attack, 1)[0].type, 'debuff-resisted');
  assert.equal(combat.applyWeaponEffects(attack, 2)[0].type, 'debuff-resisted');
  assert.equal(enemy.resistance, 0);
  assert.equal(combat.applyWeaponEffects(attack, 3)[0].type, 'burn-applied');
  combat.fighters.player.weapons[0].readyAt = Infinity;
  enemy.armor = 0;
  assert.equal(combat.advance(5800).some(event => event.type === 'armor'), false);
  assert.equal(combat.advance(100).find(event => event.type === 'armor').amount, 6);
  assert.equal(combat.advance(5900).find(event => event.type === 'armor').amount, 6);
});
