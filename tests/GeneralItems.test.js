import test from 'node:test';
import assert from 'node:assert/strict';
import Combat from '../src/systems/Combat.js';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import { generalItems } from '../src/data/generalItems.js';
import { getShopCatalog, shopCatalog } from '../src/data/shopCatalog.js';
import { getItemClass } from '../src/data/itemClasses.js';
import { getItemDetails } from '../src/utils/itemDetails.js';

const item = (id, x = 0, y = 0, extra = {}) => ({ id, catalogId: id, x, y, width: 1, height: 1, ...extra });
const board = (items = []) => ({ columns: 8, rows: 8,
  bags: [item('traveler-bag', 0, 0, { width: 4, height: 4 })], items });
const fight = items => new Combat(board(items), board(), { random: () => 0.5 });

test('itens gerais e Ferro refinado são disponíveis para qualquer classe, sem IDs duplicados', () => {
  assert.equal(new Set(generalItems.map(piece => piece.id)).size, generalItems.length);
  for (const classId of [null, 'arthur', 'future-class']) {
    const ids = getShopCatalog(classId).map(piece => piece.id);
    for (const piece of generalItems) assert.equal(ids.includes(piece.id), piece.acquisition !== 'fusion');
    assert.ok(ids.includes('refined-iron'));
  }
  for (const piece of [...generalItems, shopCatalog.find(piece => piece.id === 'refined-iron')]) {
    assert.equal(piece.pool, 'general');
    assert.deepEqual(getItemDetails(piece).itemClass, { id: 'general', symbol: 'G', name: 'Geral' });
  }
  assert.deepEqual(getItemClass({ pool: 'arthur' }), { id: 'arthur', symbol: '🗡', name: 'Arthur' });
});

test('cada item novo de compra direta pode aparecer na loja de qualquer classe', () => {
  for (const piece of generalItems.filter(item => item.acquisition !== 'fusion')) {
    const index = shopCatalog.findIndex(entry => entry.id === piece.id);
    const session = new ShoppingSession({ classId: 'arthur', random: () => (index + 0.1) / shopCatalog.length });
    assert.equal(session.reroll(), null);
    assert.equal(session.offers[0].id, piece.id);
    assert.equal(session.buy(piece.id), null);
    assert.equal(session.gold, 13 - piece.price);
    assert.equal(session.board.items[0].pool, 'general');
  }
});

test('Cristal vital concede quatro de vida inicial e máxima por cópia posicionada', () => {
  const combat = fight([item('vital-crystal'), item('vital-crystal', 1, 0, { id: 'vital#2' }),
    item('vital-crystal', null, null, { id: 'stored' })]);
  assert.equal(combat.fighters.player.health, 38);
  assert.equal(combat.fighters.player.maxHealth, 38);
  assert.equal(combat.fighters.enemy.maxHealth, 30);
});

test('novos cristais são compráveis por três de ouro, ocupam um slot e exibem seus bônus', () => {
  for (const [id, attribute, value] of [
    ['armored-crystal', 'Armadura inicial', '+4'], ['energy-crystal', 'Estamina', '+1'],
  ]) {
    const definition = shopCatalog.find(piece => piece.id === id);
    assert.ok(definition);
    assert.equal(definition.price, 3);
    assert.equal(definition.width, 1);
    assert.equal(definition.height, 1);
    const session = new ShoppingSession();
    session.offers[0] = { id, sold: false, locked: false };
    const gold = session.gold;
    assert.equal(session.buy(id), null);
    assert.equal(session.gold, gold - 3);
    assert.equal(session.board.items[0].catalogId, id);
    const details = getItemDetails(id);
    assert.equal(Object.fromEntries(details.attributes)[attribute], value);
    assert.ok(details.effects.some(effect => effect.includes('Valor de venda: 1 de ouro.')));
  }
});

test('Cristal armadurado soma quatro por cópia equipada nos dois lados e não regenera', () => {
  const equipped = board([item('armored-crystal'),
    item('armored-crystal', 1, 0, { id: 'armored#2' }),
    item('armored-crystal', null, null, { id: 'stored' })]);
  const combat = new Combat(equipped, equipped);
  for (const side of ['player', 'enemy']) {
    assert.equal(combat.fighters[side].armor, 8);
    combat.applyAttack({ target: side, hit: true, damage: 10 });
    assert.equal(combat.fighters[side].armor, 0);
    assert.equal(combat.fighters[side].health, 28);
  }
  combat.advance(5000);
  assert.equal(combat.fighters.player.armor, 0);
  assert.equal(combat.fighters.enemy.armor, 0);
  assert.equal(new Combat(equipped, board()).fighters.player.armor, 8);
});

test('Cristal energético soma um à estamina inicial e máxima e mantém recuperação e limite', () => {
  const equipped = board([item('energy-crystal'),
    item('energy-crystal', 1, 0, { id: 'energy#2' }),
    item('energy-crystal', null, null, { id: 'stored' })]);
  const combat = new Combat(equipped, equipped);
  for (const side of ['player', 'enemy']) {
    assert.equal(combat.fighters[side].stamina, 6.4);
    assert.equal(combat.fighters[side].maxStamina, 6.4);
    combat.fighters[side].stamina = 0;
  }
  combat.advance(1000);
  assert.equal(combat.fighters.player.stamina, 1);
  assert.equal(combat.fighters.enemy.stamina, 1);
  combat.advance(6000);
  assert.equal(combat.fighters.player.stamina, 6.4);
  assert.equal(combat.fighters.enemy.stamina, 6.4);
});

test('Escudo de ferro mantém nove de armadura e bloqueia na faixa de 45%', () => {
  const combat = new Combat(board(), board([item('iron-shield')]), { random: () => 0.44 });
  const result = combat.applyAttack({ side: 'player', target: 'enemy', hit: true, damage: 3 });
  assert.equal(result.blocked, 1.8);
  assert.equal(result.armorDamage, 1.2);
  assert.equal(combat.fighters.enemy.armor, 7.8);
  assert.equal(combat.fighters.enemy.health, 30);
  combat.random = () => 0.45;
  assert.equal(combat.applyAttack({ target: 'enemy', hit: true, damage: 3 }).blocked, 0);
});

test('Poção de vigor só ativa com pouca estamina e não é reutilizada', () => {
  const combat = fight([item('vigor-potion')]);
  combat.fighters.player.stamina = 1.2;
  assert.deepEqual(combat.advance(100), []);
  combat.fighters.player.stamina = 0.8;
  const events = combat.advance(100);
  assert.equal(events[0].type, 'stamina');
  assert.equal(events[0].amount, 2.4);
  assert.equal(combat.fighters.player.stamina, 3.3);
  assert.equal(combat.fighters.player.potions[0].consumed, true);
  combat.fighters.player.stamina = 0;
  assert.deepEqual(combat.advance(100), []);
  assert.equal(combat.fighters.player.stamina, 0.1);
});

test('Poção de proteção espera a armadura acabar e concede seis somente uma vez', () => {
  const combat = fight([item('shield'), item('protection-potion', 2, 0)]);
  assert.deepEqual(combat.advance(100), []);
  combat.fighters.player.armor = 0;
  assert.equal(combat.advance(100)[0].amount, 6);
  assert.equal(combat.fighters.player.armor, 6);
  combat.fighters.player.armor = 0;
  assert.deepEqual(combat.advance(100), []);
  const unarmored = fight([item('protection-potion')]);
  unarmored.advance(100);
  assert.equal(unarmored.fighters.player.armor, 6);
});

test('regeneração cura seis imediatamente e seis pulsos de 1,2 sem reativar a poção', () => {
  const combat = fight([item('regeneration-potion')]);
  combat.fighters.player.health = 12;
  assert.equal(combat.advance(100)[0].healing, 6);
  assert.equal(combat.fighters.player.health, 18);
  const events = combat.advance(6000);
  assert.equal(events.filter(event => event.regeneration).length, 6);
  assert.equal(combat.fighters.player.health, 25.2);
  assert.equal(combat.fighters.player.regenerations[0].remaining, 0);
  assert.deepEqual(combat.advance(1000), []);
});

test('regeneração respeita o limite de vida e não revive nem cura após golpes letais simultâneos', () => {
  const combat = fight([item('regeneration-potion')]);
  combat.fighters.player.health = 18;
  combat.advance(7000);
  assert.equal(combat.fighters.player.health, 30);
  const armed = board([item('sword', 0, 0, { width: 1, height: 3 }), item('regeneration-potion', 1, 0)]);
  const duel = new Combat(armed, armed, { random: () => 0.5 });
  for (const fighter of Object.values(duel.fighters)) fighter.health = 12;
  duel.advance(1900);
  for (const fighter of Object.values(duel.fighters)) fighter.health = 1.8;
  const events = duel.advance(100);
  assert.equal(duel.result, 'draw');
  assert.equal(events.filter(event => event.type === 'heal').length, 0);
});

test('pedras afetam somente armas nas estrelas, acompanham giros e não alteram o inventário', () => {
  const sword = item('sword', 0, 0, { width: 1, height: 3 });
  const stone = item('whetstone', 1, 1);
  const input = board([sword, stone]);
  const before = JSON.stringify(input);
  const combat = new Combat(input, board(), { random: () => 0.5 });
  assert.equal(combat.fighters.player.weapons[0].damage, 2.1);
  assert.equal(combat.advance(2000)[0].damage, 2.1);
  assert.equal(JSON.stringify(input), before);
  assert.equal(fight([sword, { ...stone, rotation: 90 }]).fighters.player.weapons[0].damage, 1.8);
  assert.equal(fight([sword, { ...stone, x: null, y: null }]).fighters.player.weapons[0].damage, 1.8);
  assert.equal(fight([{ ...sword, x: 1 }, { ...stone, y: 3, rotation: 90 }]).fighters.player.weapons[0].damage, 2.1);
});

test('celeridade reduz primeira recarga e seguintes, preservando custo de estamina', () => {
  const combat = fight([item('sword', 0, 0, { width: 1, height: 3 }), item('haste-stone', 1, 1)]);
  assert.equal(combat.fighters.player.weapons[0].cooldown, 1.8);
  assert.deepEqual(combat.advance(1700), []);
  assert.equal(combat.advance(100)[0].damage, 1.8);
  assert.equal(combat.fighters.player.stamina, 3.2);
  assert.equal(combat.fighters.player.weapons[0].readyAt, 3.6);
});

test('empilhar pedras respeita os limites de +0,9 de dano e 30% de recarga', () => {
  const positions = [[1, 2], [3, 2], [1, 3], [3, 3]];
  for (const id of ['whetstone', 'haste-stone']) {
    const items = [item('sword', 2, 2, { width: 1, height: 3 }), ...positions.map(([x, y], i) => item(id, x, y, { id: `${id}#${i}` }))];
    const weapon = fight(items).fighters.player.weapons[0];
    assert.equal(weapon.damage, id === 'whetstone' ? 2.7 : 1.8);
    assert.equal(weapon.cooldown, id === 'haste-stone' ? 1.4 : 2);
  }
});

test('consumíveis novos ativam Ferro refinado uma vez e peças guardadas não têm efeito', () => {
  const combat = new Combat(board([item('vigor-potion', 0, 1), item('refined-iron', 1, 1)]), board(), { random: () => 0.2 });
  combat.fighters.player.stamina = 0.5;
  const events = combat.advance(100);
  assert.equal(events.filter(event => event.type === 'armor').length, 1);
  assert.equal(combat.fighters.player.armor, 2.4);
  assert.equal(combat.advance(100).filter(event => event.type === 'armor').length, 0);
  const stored = fight(generalItems.map(piece => ({ ...piece, x: null, y: null })));
  assert.equal(stored.fighters.player.health, 30);
  assert.equal(stored.fighters.player.armor, 0);
  assert.equal(stored.fighters.player.potions.length, 0);
});
