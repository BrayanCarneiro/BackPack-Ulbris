import test from 'node:test';
import assert from 'node:assert/strict';
import Combat from '../src/systems/Combat.js';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import { allItems, getShopCatalog } from '../src/data/shopCatalog.js';
import { arthurItems } from '../src/data/arthurItems.js';
import { itemRecipes } from '../src/data/itemRecipes.js';
import { getReadyFusions } from '../src/utils/itemFusions.js';
import { rotateFootprint } from '../src/utils/rotation.js';
import { seededRandom } from '../src/utils/seededRandom.js';

const piece = (id, x = 0, y = 0, extra = {}) => ({ ...allItems.find(item => item.id === id), catalogId: id, x, y, ...extra });
const board = (items = [], bags = [], classId = 'arthur') => ({ columns: 8, rows: 8, items, bags, classId });
const fight = (items = [], bags = []) => new Combat(board(items, bags), board(), { random: () => 0.5 });
const hit = (combat, damage, target = 'player') => {
  const events = [];
  const attack = combat.applyAttack({ type: 'attack', side: target === 'player' ? 'enemy' : 'player',
    target, itemId: 'test', hit: true, critical: false, damage }, events);
  return { attack, events };
};

test('sete itens exclusivos; Arthur começa com mochila equipada sem gastar ouro', () => {
  const arthur = new ShoppingSession({ classId: 'arthur' });
  const other = new ShoppingSession({ classId: 'other' });
  assert.equal(arthurItems.length, 7);
  assert.ok(arthurItems.every(item => item.pool === 'arthur'));
  assert.ok(getShopCatalog('other').every(item => item.pool !== 'arthur'));
  assert.ok(arthur.catalog.some(item => item.id === 'oath-ring'));
  assert.ok(arthur.catalog.some(item => item.id === 'bastion-chestplate'));
  assert.ok(!arthur.catalog.some(item => item.id === 'excalibur'));
  assert.equal(arthur.gold, other.gold);
  assert.equal(other.board.bags.length, 0);
  assert.equal(arthur.board.bags[0].catalogId, 'knight-bag');
  assert.equal(arthur.board.bags[0].x, 0);
  assert.equal(arthur.board.getPlacementError('bag', 'knight-bag', 0, 0), null);
});

test('anel acompanha perda acumulada de vida, ignora dano à armadura e ativa só uma vez', () => {
  const combat = fight([piece('oath-ring')]);
  const fighter = combat.fighters.player;
  fighter.armor = 10;
  hit(combat, 10);
  assert.equal(fighter.healthLost, 0);
  hit(combat, 7.4);
  assert.equal(fighter.armor, 0);
  fighter.health += 3;
  const { events } = hit(combat, 0.1);
  assert.equal(fighter.armor, 10);
  assert.ok(events.some(event => event.type === 'armor' && event.amount === 10));
  hit(combat, 12);
  assert.equal(fighter.armor, 0);
  assert.equal(fight([piece('oath-ring')]).fighters.player.oathRings[0].consumed, false);
  assert.equal(fight([piece('oath-ring', null, null)]).fighters.player.oathRings.length, 0);
});

test('Elmo do Comandante mantém proteções e recupera armadura a cada vez que perder a última unidade', () => {
  const combat = fight([piece('commander-helmet')]);
  const fighter = combat.fighters.player;
  assert.equal(fighter.armor, 9);
  assert.equal(fighter.stunDurationMultiplier, 0.55);
  assert.equal(fighter.criticalDamageMultiplier, 0.7);
  hit(combat, 9);
  assert.equal(fighter.armor, 5);
  hit(combat, 5);
  assert.equal(fighter.armor, 5);
  assert.equal(fighter.health, 30);
  fighter.armor = 0;
  hit(combat, 1);
  assert.equal(fighter.armor, 0);
});

test('mochila aumenta armadura e proteção de peças inteiras, acompanha giros e não afeta cristais ou reserva', () => {
  const items = [piece('commander-helmet', 0, 0), piece('armored-crystal', 3, 3), piece('iron-armor', null, null)];
  const fighter = fight(items, [piece('knight-bag')]).fighters.player;
  assert.equal(fighter.armor, 13.9);
  assert.ok(Math.abs(fighter.stunDurationMultiplier - 0.505) < 1e-8);
  assert.equal(fighter.depletedRestores[0].amount, 5.5);
  assert.equal(fight([piece('iron-helmet', 3, 0)], [piece('knight-bag')]).fighters.player.armor, 6);
  assert.equal(fight([rotateFootprint(piece('iron-helmet', 3, 0), 1)], [piece('knight-bag')]).fighters.player.armor, 6.6);
  assert.equal(fight([piece('iron-helmet')], [piece('knight-bag', null, null)]).fighters.player.armor, 6);
});

test('Bastião reduz dano enquanto há armadura, incluindo golpe que a esgota e dano periódico', () => {
  const combat = fight([piece('bastion-chestplate')]);
  const fighter = combat.fighters.player;
  assert.equal(fighter.armor, 15);
  fighter.armor = 1;
  assert.equal(hit(combat, 10).attack.healthDamage, 8);
  assert.equal(hit(combat, 10).attack.healthDamage, 10);
  const burning = fight([piece('bastion-chestplate')]);
  burning.fighters.player.burns.push({ damage: 3, remaining: 2, nextAt: 1, ignoresArmor: true });
  assert.equal(burning.advance(1000).find(event => event.type === 'burn').healthDamage, 2.7);
});

test('sangramento causa três pulsos de dois direto à vida, sem renovar outros acúmulos', () => {
  const combat = fight([piece('bloody-sword')]);
  combat.random = () => 0.1;
  const fighter = combat.fighters.enemy;
  fighter.armor = 10;
  const attack = { side: 'player', target: 'enemy', itemId: 'bloody-sword', hit: true, damage: 5, blocked: 0 };
  assert.equal(combat.applyWeaponEffects(attack, 0)[0].type, 'bleed-applied');
  combat.fighters.player.weapons[0].readyAt = Infinity;
  const events = combat.advance(3000).filter(event => event.type === 'bleed');
  assert.deepEqual(events.map(event => event.healthDamage), [2, 2, 2]);
  assert.equal(fighter.health, 24);
  assert.equal(fighter.armor, 10);
  assert.equal(fighter.bleeds.length, 0);
  assert.equal(combat.advance(1000).some(event => event.type === 'bleed'), false);
});

test('Sangrenta usa 20% de crítico só contra sangramento ativo e resistência bloqueia a aplicação', () => {
  const combat = fight([piece('bloody-sword')]);
  const weapon = combat.fighters.player.weapons[0];
  combat.random = () => 0.1;
  assert.equal(combat.rollAttack('player', weapon).critical, false);
  combat.fighters.enemy.bleeds.push({ remaining: 1 });
  assert.equal(combat.rollAttack('player', weapon).critical, true);
  combat.fighters.enemy.bleeds[0].remaining = 0;
  assert.equal(combat.rollAttack('player', weapon).critical, false);
  combat.fighters.enemy.resistance = 1;
  const events = combat.applyWeaponEffects({ side: 'player', target: 'enemy', itemId: weapon.id, blocked: 0, damage: 5 }, 0);
  assert.ok(events.some(event => event.type === 'debuff-resisted' && event.debuff === 'bleed'));
  assert.equal(combat.fighters.enemy.resistance, 0);
});

test('Espada Grande verifica armadura maior que 15 antes de cada ataque e restaura o custo ao perder proteção', () => {
  for (const [armor, expected] of [[15, 0], [15.001, 1]]) {
    const combat = fight([piece('knight-greatsword')]);
    const fighter = combat.fighters.player;
    fighter.armor = armor;
    fighter.stamina = fighter.maxStamina = 0;
    assert.equal(combat.advance(3200).filter(event => event.type === 'attack').length, expected);
    fighter.armor = 0;
    assert.equal(combat.advance(3200).some(event => event.type === 'attack'), false);
  }
});

test('Excalibur ilumina cada quinto ataque, concede cinco de armadura e reinicia o ciclo', () => {
  const combat = fight([piece('excalibur')]);
  const fighter = combat.fighters.player;
  fighter.stamina = fighter.maxStamina = 100;
  combat.fighters.enemy.health = combat.fighters.enemy.maxHealth = 1000;
  const events = combat.advance(25000);
  const attacks = events.filter(event => event.type === 'attack');
  assert.equal(attacks.length, 10);
  assert.deepEqual(attacks.filter(event => event.imbued).map(event => event.damage), [25, 25]);
  assert.deepEqual(events.filter(event => event.excalibur).map(event => event.amount), [5, 5]);
  assert.equal(fighter.armor, 10);
});

test('Excalibur herda apenas cura de Última Luz uma vez, preserva debuffs e não revive', () => {
  const combat = fight([piece('excalibur')]);
  const fighter = combat.fighters.player;
  fighter.health = 9;
  fighter.burns.push({ remaining: 2, nextAt: 1 });
  fighter.bleeds.push({ remaining: 3, nextAt: 1 });
  fighter.stunnedUntil = 10;
  hit(combat, 2);
  assert.equal(fighter.health, 13);
  assert.equal(fighter.burns.length, 1);
  assert.equal(fighter.bleeds.length, 1);
  assert.equal(fighter.stunnedUntil, 10);
  hit(combat, 6);
  assert.equal(fighter.health, 7);
  hit(combat, 100);
  assert.equal(fighter.health, 0);
});

test('receitas de Arthur exigem classe correta, ingredientes distintos conectados e batalha completa', () => {
  for (const recipe of itemRecipes.filter(recipe => recipe.pool === 'arthur')) {
    const items = [];
    let x = 0;
    for (const id of recipe.ingredients) {
      const item = piece(id, x, 0);
      if (recipe.requiredOathBattles && id === recipe.ingredients[0]) item.oathBattles = recipe.requiredOathBattles;
      items.push(item);
      x += item.width;
    }
    assert.equal(getReadyFusions(items, 'other').length, 0);
    assert.equal(getReadyFusions(items, 'arthur')[0].resultId, recipe.result);
    const session = new ShoppingSession({ classId: 'arthur', campaign: false });
    session.board.bags = [piece('knight-bag', 0, 0, { width: 8, height: 8 })];
    session.board.items = items;
    assert.equal(session.beginBattle(), true);
    assert.equal(items[0].catalogId, recipe.ingredients[0]);
    session.finishBattle('draw');
    assert.equal(session.board.items[0].catalogId, recipe.result);
    assert.equal(session.board.items.length, 1);
    const missing = items.map(item => ({ ...item }));
    missing.at(-1).x = null;
    assert.equal(getReadyFusions(missing, 'arthur').length, 0);
  }
});

test('resultado maior de fusão vai para reserva quando não cabe e cancelamento não consome ingredientes', () => {
  const session = new ShoppingSession({ classId: 'arthur', campaign: false });
  session.board.bags = [piece('knight-bag', 0, 0, { width: 5, height: 3 })];
  session.board.items = [piece('iron-sword', 0, 0), piece('whetstone', 1, 0), piece('haste-stone', 2, 0), piece('refined-iron', 3, 0)];
  assert.equal(session.beginBattle(), true);
  session.cancelBattle();
  assert.equal(session.board.items.length, 4);
  assert.equal(session.beginBattle(), true);
  const report = session.finishBattle('victory');
  assert.equal(report.fusions, 1);
  assert.equal(session.board.items[0].catalogId, 'knight-greatsword');
  assert.equal(session.board.items[0].x, null);
});

test('Última Luz do cristal remove todos os sangramentos antes dos próximos pulsos do mesmo instante', () => {
  const combat = fight([piece('golden-crystal')]);
  const fighter = combat.fighters.player;
  fighter.health = 9;
  fighter.bleeds = Array.from({ length: 3 }, () => ({ damage: 2, remaining: 3, nextAt: 1 }));
  const events = combat.advance(1000);
  assert.equal(events.filter(event => event.type === 'bleed').length, 1);
  assert.equal(fighter.health, 13);
  assert.equal(fighter.bleeds.length, 0);
});

test('novos efeitos são simétricos e produzem os mesmos eventos com frames grandes ou irregulares', () => {
  const layout = board([piece('bloody-sword', 0, 0), piece('excalibur', 2, 0),
    piece('bastion-chestplate', 4, 0), piece('commander-helmet', 4, 3), piece('oath-ring', 6, 0)],
  [piece('knight-bag', 0, 0), piece('knight-bag', 4, 0, { id: 'knight-bag#2' })]);
  const simulate = frames => {
    const combat = new Combat(layout, layout, { random: seededRandom(9173) });
    const events = [];
    for (const ms of frames) events.push(...combat.advance(ms));
    return { events, fighters: combat.fighters, result: combat.result };
  };
  const irregular = [];
  let remaining = 90000;
  while (remaining > 0) {
    const ms = Math.min(remaining, [17, 83, 241, 57][irregular.length % 4]);
    irregular.push(ms); remaining -= ms;
  }
  assert.deepEqual(simulate(irregular), simulate([90000]));
  const combat = new Combat(layout, layout, { random: () => 0.5 });
  assert.deepEqual(combat.fighters.player, combat.fighters.enemy);
});
