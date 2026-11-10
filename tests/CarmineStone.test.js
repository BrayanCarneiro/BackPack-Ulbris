import test from 'node:test';
import assert from 'node:assert/strict';
import Combat from '../src/systems/Combat.js';
import { allItems } from '../src/data/shopCatalog.js';
import { getStarCells } from '../src/utils/itemStars.js';
import { getItemDetails } from '../src/utils/itemDetails.js';

const item = (id, x, y, extra = {}) => ({ ...allItems.find(piece => piece.id === id), id, catalogId: id, x, y, ...extra });
const board = items => ({ bags: [], items });
const setup = (weapon = 'quick-daggers', enemies = [], random = () => 0.5) => new Combat(
  board([item('carmine-stone', 0, 0), item(weapon, 1, 0)]), board(enemies), { random });
const sequence = values => () => { assert.ok(values.length, 'Sorteio inesperado'); return values.shift(); };

test('Pedra Carmim tem uma única estrela, à direita inicialmente, com quatro direções', () => {
  const stone = item('carmine-stone', 3, 3);
  const expected = [{ x: 4, y: 3 }, { x: 3, y: 4 }, { x: 2, y: 3 }, { x: 3, y: 2 }];
  expected.forEach((cell, turns) => assert.deepEqual(getStarCells({ ...stone, rotation: turns * 90 }), [cell]));
  const details = getItemDetails(stone);
  assert.ok(details.effects.some(effect => effect.includes('5%') && effect.includes('50%')));
  assert.equal(details.piece.price, 3);
});

test('roubo de vida respeita a fronteira dos 5% e cura metade do dano do golpe', () => {
  for (const roll of [0.049999, 0.05]) {
    const combat = setup('quick-daggers', [], sequence([0.1, 0.9, 0.9, roll]));
    combat.fighters.player.health = 20;
    const events = combat.advance(1300);
    assert.equal(combat.fighters.player.health, roll < 0.05 ? 20.5 : 20);
    assert.equal(events.filter(event => event.lifeSteal).length, roll < 0.05 ? 1 : 0);
  }
});

test('críticos e extras podem roubar vida e a cura não ultrapassa o máximo', () => {
  const critical = setup('quick-daggers', [], sequence([0.1, 0.01, 0.9, 0.01]));
  critical.fighters.player.health = 20;
  assert.equal(critical.advance(1300).find(event => event.lifeSteal).healing, 0.75);
  const extra = setup('sword', [], sequence([0.1, 0.9, 0.01, 0.1, 0.9, 0.01, 0.01]));
  extra.fighters.player.health = 20;
  assert.equal(extra.advance(2000).filter(event => event.lifeSteal).length, 2);
  assert.equal(extra.fighters.player.health, 21.8);
  const capped = setup('quick-daggers', [], sequence([0.1, 0.9, 0.9, 0.01]));
  capped.fighters.player.health = 29.9;
  assert.equal(capped.advance(1300).find(event => event.lifeSteal).healing, 0.1);
  assert.equal(capped.fighters.player.health, 30);
});

test('erros e golpes absorvidos pela armadura ou bloqueio não curam', () => {
  const missed = setup('quick-daggers', [], sequence([0.99]));
  missed.fighters.player.health = 20;
  assert.equal(missed.advance(1300).some(event => event.lifeSteal), false);
  const armored = setup('quick-daggers', [item('shield', 0, 0)], sequence([0.1, 0.9, 0.9, 0.9]));
  armored.fighters.player.health = 20;
  assert.equal(armored.advance(1300).some(event => event.lifeSteal), false);
  assert.equal(armored.fighters.player.health, 20);
  const blocked = setup('quick-daggers', [item('shield', 0, 0)], () => 0);
  blocked.fighters.player.health = 20;
  assert.equal(blocked.advance(1300).some(event => event.lifeSteal), false);
});

test('somente o dano efetivo à vida entra na cura, sem contar armadura ou excesso letal', () => {
  const combat = setup();
  combat.random = () => 0;
  const attack = { side: 'player', target: 'enemy', itemId: 'quick-daggers', hit: true, damage: 10 };
  combat.fighters.enemy.armor = 6;
  assert.equal(combat.rollLifeSteal(combat.applyAttack(attack)), 2);
  combat.fighters.enemy.health = 1;
  assert.equal(combat.rollLifeSteal(combat.applyAttack(attack)), 0.5);
});

test('roubo de vida não revive em golpes letais simultâneos e queimadura não o ativa', () => {
  const items = [item('carmine-stone', 0, 0), item('quick-daggers', 1, 0)];
  const duel = new Combat(board(items), board(items), { random: () => 0 });
  duel.fighters.player.health = 1;
  duel.fighters.enemy.health = 1;
  assert.equal(duel.advance(1300).some(event => event.lifeSteal), false);
  assert.equal(duel.result, 'draw');
  const burn = setup('flaming-daggers', [], () => 0);
  burn.fighters.player.health = 20;
  burn.advance(1300);
  const health = burn.fighters.player.health;
  burn.fighters.player.weapons[0].readyAt = Infinity;
  assert.equal(burn.advance(2000).some(event => event.lifeSteal), false);
  assert.equal(burn.fighters.player.health, health);
});
