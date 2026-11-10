import test from 'node:test';
import assert from 'node:assert/strict';
import Combat from '../src/systems/Combat.js';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import { allItems, shopCatalog } from '../src/data/shopCatalog.js';
import { getItemDetails } from '../src/utils/itemDetails.js';
import { getFootprintCells, occupiesCell, rotateFootprint } from '../src/utils/rotation.js';

const item = (id, x = 0, y = 0, extra = {}) => ({ ...allItems.find(piece => piece.id === id),
  id, catalogId: id, x, y, ...extra });
const board = (items = []) => ({ bags: [], items });
const fight = (items = [], enemy = []) => new Combat(board(items), board(enemy), { random: () => 0.5 });
function recipeSession() {
  const session = new ShoppingSession();
  session.board.bags.push(item('traveler-bag'));
  session.board.items.push(item('iron-armor', 1, 0), item('carmine-stone'), item('vital-crystal', 3, 0));
  return session;
}

test('Peitoral Vampírico ocupa oito espaços com ombreiras e seus vazios continuam utilizáveis', () => {
  const armor = item('vampiric-chestplate');
  assert.deepEqual([armor.width, armor.height, getFootprintCells(armor).length], [4, 3, 8]);
  for (const x of [0, 1, 2, 3]) assert.equal(occupiesCell(armor, x, 0), true);
  for (const x of [0, 3]) for (const y of [1, 2]) assert.equal(occupiesCell(armor, x, y), false);
  const session = new ShoppingSession();
  session.board.bags.push(item('traveler-bag'));
  session.board.items.push(armor, item('potion', null, null));
  assert.equal(session.board.move('item', 'potion', 0, 1), null);
  for (let turns = 0; turns < 4; turns++) {
    const rotated = rotateFootprint(armor, turns);
    assert.equal(getFootprintCells(rotated).length, 8);
    assert.equal(rotated.width, turns % 2 ? 3 : 4);
  }
});

test('atributos e ficha incluem 10 de defesa, quatro de vida e duas resistências, sem geração de armadura', () => {
  const combat = fight([item('vampiric-chestplate')]);
  const fighter = combat.fighters.player;
  assert.deepEqual([fighter.armor, fighter.health, fighter.maxHealth, fighter.resistance], [10, 34, 34, 2]);
  assert.equal(fighter.armorGenerators.length, 0);
  assert.equal(shopCatalog.some(piece => piece.id === 'vampiric-chestplate'), false);
  const details = getItemDetails('vampiric-chestplate');
  assert.equal(details.piece.price, 18);
  assert.deepEqual(Object.fromEntries(details.attributes), {
    'Armadura inicial': '+10', 'Resistência': '+2', 'Vida máxima': '+4',
  });
  assert.ok(details.effects.some(effect => effect.includes('10%')));
  const stored = fight([item('vampiric-chestplate', null, null)]).fighters.player;
  assert.deepEqual([stored.armor, stored.maxHealth, stored.resistance, stored.damageHealers.length], [0, 30, 0, 0]);
});

test('cura 10% da vida perdida por golpe, ignorando dano à armadura e respeitando dano letal', () => {
  const combat = fight([], [item('vampiric-chestplate')]);
  const events = [];
  combat.applyAttack({ target: 'enemy', hit: true, damage: 5 }, events);
  assert.equal(events.length, 0);
  assert.equal(combat.fighters.enemy.health, 34);
  const hit = combat.applyAttack({ target: 'enemy', hit: true, damage: 15 }, events);
  assert.equal(hit.armorDamage, 5);
  assert.equal(hit.healthDamage, 10);
  assert.equal(events[0].healing, 1);
  assert.equal(combat.fighters.enemy.health, 25);
  combat.applyAttack({ target: 'enemy', hit: false, damage: 0 }, events);
  assert.equal(events.length, 1);
  combat.applyAttack({ target: 'enemy', hit: true, damage: 100 }, events);
  assert.equal(combat.fighters.enemy.health, 0);
  assert.equal(events.length, 1);
});

test('queimadura e fadiga também curam sobre dano à vida, sem reviver no pulso letal', () => {
  const combat = fight([item('vampiric-chestplate')]);
  combat.fighters.player.burns.push({ source: 'enemy', itemId: 'test', damage: 2,
    ignoresArmor: true, remaining: 1, nextAt: 1 });
  const healed = combat.advance(1000).find(event => event.damageHealing);
  assert.equal(healed.healing, 0.2);
  assert.equal(combat.fighters.player.health, 32.2);
  combat.advance(59000);
  assert.equal(combat.advance(1000).find(event => event.damageHealing).healing, 0.06);
  combat.fighters.player.health = 0.5;
  assert.equal(combat.advance(1000).some(event => event.damageHealing), false);
  assert.equal(combat.result, 'defeat');
});

test('fusão consome pedra e cristal, preserva o torso e funciona após qualquer resultado', () => {
  for (const result of ['victory', 'defeat', 'draw']) {
    const session = recipeSession();
    session.beginBattle();
    assert.equal(session.board.items.length, 3);
    assert.deepEqual(session.finishBattle(result).fusionNames, ['Peitoral Vampírico']);
    const armor = session.board.items[0];
    assert.equal(session.board.items.length, 1);
    assert.deepEqual([armor.id, armor.catalogId, armor.x, armor.y, armor.width, armor.height],
      ['iron-armor', 'vampiric-chestplate', 0, 0, 4, 3]);
    assert.equal(fight([armor]).fighters.player.maxHealth, 34);
  }
});

test('receita não funde com ingrediente faltando, na reserva, distante ou fora da estrela', () => {
  for (const mode of ['missing-crystal', 'stored-crystal', 'far-crystal', 'diagonal-crystal', 'wrong-star', 'stored-stone', 'cancel']) {
    const session = recipeSession();
    if (mode === 'missing-crystal') session.board.items.pop();
    if (mode === 'stored-crystal') session.board.store('item', 'vital-crystal');
    if (mode === 'stored-stone') session.board.store('item', 'carmine-stone');
    if (mode === 'far-crystal') {
      Object.assign(session.board.bags[0], { width: 8, height: 8 });
      assert.equal(session.board.move('item', 'vital-crystal', 7, 7), null);
    }
    if (mode === 'diagonal-crystal') session.board.move('item', 'vital-crystal', 0, 3);
    if (mode === 'wrong-star') session.board.items.find(piece => piece.id === 'carmine-stone').rotation = 180;
    session.beginBattle();
    if (mode === 'cancel') session.cancelBattle();
    assert.equal(session.finishBattle('victory')?.fusions ?? 0, 0, mode);
    assert.equal(session.board.items[0].catalogId, 'iron-armor', mode);
  }
});

test('ombreiras respeitam colisões e suporte; resultado sem espaço vai para a reserva', () => {
  const session = recipeSession();
  session.board.move('item', 'vital-crystal', 3, 1);
  session.board.items.push(item('potion', 3, 0));
  session.beginBattle();
  const report = session.finishBattle('victory');
  assert.equal(report.fusions, 1);
  assert.deepEqual(report.storedFusionNames, ['Peitoral Vampírico']);
  assert.equal(session.board.items[0].x, null);
  assert.equal(session.board.items[0].y, null);
  assert.equal(session.board.items.find(piece => piece.id === 'potion').x, 3);
});

test('fusão preserva orientação do torso e ombreiras nos quatro giros', () => {
  for (let turns = 0; turns < 4; turns++) {
    const session = new ShoppingSession();
    session.board.bags.push({ id: 'test-bag', kind: 'bag', x: 0, y: 0, width: 8, height: 8 });
    const armor = { ...rotateFootprint(item('iron-armor', 3, 3), turns) };
    session.board.items.push(armor, item('carmine-stone', 2, 3),
      item('vital-crystal', 3 + armor.width, 3));
    session.beginBattle();
    assert.equal(session.finishBattle('victory').fusions, 1);
    assert.equal(armor.rotation, turns * 90);
    assert.deepEqual([armor.x, armor.y], turns % 2 ? [3, 2] : [2, 3]);
    assert.equal(session.board.getPlacementError('item', armor.id, armor.x, armor.y), null);
  }
});

test('efeito funciona simetricamente nos dois lados e independe dos frames', () => {
  const items = [item('vampiric-chestplate'), item('sword', 4, 0)];
  const whole = fight(items, items);
  const steps = fight(items, items);
  whole.advance(70000);
  for (let i = 0; i < 700; i++) steps.advance(100);
  assert.deepEqual(whole.fighters, steps.fighters);
  assert.equal(whole.result, steps.result);
  assert.deepEqual(whole.fighters.player, whole.fighters.enemy);
});
