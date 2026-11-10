import test from 'node:test';
import assert from 'node:assert/strict';
import Combat from '../src/systems/Combat.js';
import { allItems } from '../src/data/shopCatalog.js';
import { getItemDetails } from '../src/utils/itemDetails.js';

const item = (id, x = 0, y = 0, extra = {}) => ({
  ...allItems.find(piece => piece.id === id), catalogId: id, id, x, y, ...extra,
});
const board = (items = []) => ({ bags: [], items });
const fight = (items = [], enemies = []) => new Combat(board(items), board(enemies), { random: () => 0 });
const effectAttack = (id, target = 'enemy') => ({ side: target === 'enemy' ? 'player' : 'enemy',
  target, itemId: id, hit: true, damage: 5, blocked: 0 });

test('escudos têm 5 e 9 de defesa; elmo e peitoral têm 3 e 6, com fichas atualizadas', () => {
  for (const [id, armor] of [['shield', 5], ['iron-shield', 9], ['leather-helmet', 3], ['leather-chestplate', 6]]) {
    assert.equal(fight([item(id)]).fighters.player.armor, armor);
    assert.equal(Object.fromEntries(getItemDetails(id).attributes)['Armadura inicial'], `+${armor}`);
  }
});

test('elmo reduz o dano total crítico em 20% antes da armadura, sem reduzir golpes comuns', () => {
  const combat = fight([], [item('leather-helmet')]);
  const critical = combat.applyAttack({ target: 'enemy', hit: true, critical: true, damage: 10 });
  assert.equal(critical.damage, 8);
  assert.equal(critical.armorDamage, 3);
  assert.equal(critical.healthDamage, 5);
  const normal = combat.applyAttack({ target: 'enemy', hit: true, critical: false, damage: 10 });
  assert.equal(normal.healthDamage, 10);
});

test('elmo encurta stun e o atraso da arma para 0,7s, inclusive ao renovar', () => {
  const combat = fight([item('battle-axe')], [item('leather-helmet'), item('sword')]);
  const attack = effectAttack('battle-axe');
  assert.equal(combat.applyWeaponEffects(attack, 1)[0].seconds, 0.7);
  assert.equal(combat.fighters.enemy.stunnedUntil, 1.7);
  assert.equal(combat.fighters.enemy.weapons[0].readyAt, 2.7);
  combat.applyWeaponEffects(attack, 1.3);
  assert.equal(combat.fighters.enemy.stunnedUntil, 2);
  assert.equal(combat.fighters.enemy.weapons[0].readyAt, 3);
});

test('resistência impede a primeira queimadura inteira e permite a próxima, renovando por batalha', () => {
  const combat = fight([item('flaming-daggers')], [item('leather-chestplate')]);
  const attack = effectAttack('flaming-daggers');
  assert.equal(combat.applyWeaponEffects(attack, 1)[0].type, 'debuff-resisted');
  assert.equal(combat.fighters.enemy.burns.length, 0);
  assert.equal(combat.fighters.enemy.resistance, 0);
  assert.equal(combat.applyWeaponEffects(attack, 2)[0].type, 'burn-applied');
  assert.equal(combat.fighters.enemy.burns.length, 1);
  combat.fighters.player.weapons[0].readyAt = Infinity;
  assert.equal(combat.advance(4000).filter(event => event.type === 'burn').length, 2);
  assert.equal(fight([], [item('leather-chestplate')]).fighters.enemy.resistance, 1);
});

test('resistência bloqueia stun e só é consumida quando o debuff seria aplicado', () => {
  const combat = fight([item('battle-axe')], [item('leather-chestplate'), item('leather-helmet'), item('sword')]);
  const attack = effectAttack('battle-axe');
  combat.random = () => 0.99;
  assert.deepEqual(combat.applyWeaponEffects(attack, 1), []);
  assert.equal(combat.fighters.enemy.resistance, 1);
  combat.random = () => 0;
  assert.equal(combat.applyWeaponEffects(attack, 1)[0].debuff, 'stun');
  assert.equal(combat.fighters.enemy.stunnedUntil, 0);
  assert.equal(combat.fighters.enemy.weapons[0].readyAt, 2);
  assert.equal(combat.applyWeaponEffects(attack, 2)[0].seconds, 0.7);
});

test('peitoral concede 3 por armadura nas estrelas em 5,9s, contando peças uma vez', () => {
  const combat = fight([item('leather-chestplate', 2, 2), item('shield', 0, 2),
    item('leather-helmet', 4, 2), item('armored-crystal', 4, 3)]);
  combat.fighters.player.armor = 0;
  assert.deepEqual(combat.advance(5800), []);
  assert.equal(combat.advance(100).find(event => event.type === 'armor').amount, 6);
  assert.equal(combat.fighters.player.armor, 6);
  combat.fighters.player.stunnedUntil = 20;
  assert.equal(combat.advance(5900).find(event => event.type === 'armor').amount, 6);
  assert.equal(combat.fighters.player.armor, 12);
});

test('peitoral gira as estrelas, ignora reserva e não conta pedras ou armas', () => {
  const rotated = item('leather-chestplate', 2, 2, { rotation: 90, width: 3, height: 2 });
  const combat = fight([rotated, item('leather-helmet', 2, 1), item('shield', 2, 4),
    item('iron-shield', 0, 2), item('leather-helmet', null, null, { id: 'stored' })]);
  assert.equal(combat.advance(5900).find(event => event.type === 'armor').amount, 6);
  const unsupported = fight([item('leather-chestplate', 2, 2), item('armored-crystal', 1, 2),
    item('sword', 4, 2)]);
  assert.equal(unsupported.advance(5900).some(event => event.type === 'armor'), false);
  const stored = fight([item('leather-chestplate', null, null), item('leather-helmet', null, null)]);
  assert.equal(stored.fighters.player.armor, 0);
  assert.equal(stored.fighters.player.resistance, 0);
  assert.equal(stored.fighters.player.stunDurationMultiplier, 1);
  assert.equal(stored.fighters.player.criticalDamageMultiplier, 1);
  assert.equal(stored.fighters.player.armorGenerators.length, 0);
});

test('armaduras seguem as mesmas regras nos dois lados e em frames diferentes', () => {
  const items = [item('leather-chestplate', 2, 2), item('leather-helmet', 0, 2), item('shield', 4, 2)];
  const first = fight(items, items);
  const second = fight(items, items);
  first.advance(20000);
  for (let i = 0; i < 200; i++) second.advance(100);
  assert.deepEqual(first.fighters, second.fighters);
  assert.equal(first.fighters.player.armor, 32);
  assert.equal(first.fighters.enemy.armor, 32);
});
