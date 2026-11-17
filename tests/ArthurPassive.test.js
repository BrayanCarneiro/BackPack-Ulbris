import test from 'node:test';
import assert from 'node:assert/strict';
import Combat from '../src/systems/Combat.js';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import { allItems } from '../src/data/shopCatalog.js';
import { getCombatItem } from '../src/data/combatItems.js';
import { getArthurBonus, getArthurStarCells, getActiveArthurStarCells } from '../src/utils/arthurPassive.js';
import { rotateFootprint } from '../src/utils/rotation.js';

const piece = (catalogId, x, y, id = catalogId) => ({
  ...structuredClone(allItems.find(item => item.id === catalogId)), catalogId, id, x, y,
});
const board = (items, classId = 'arthur') => ({ columns: 8, rows: 8, bags: [], items, classId });
const damage = (layout, side = 'player') => new Combat(layout, layout).fighters[side].weapons[0].damage;

test('Aço e Honra dá 5% por peça, sem duplicar contato e com teto de 15%', () => {
  const sword = piece('sword', 3, 2);
  const armor = [piece('leather-chestplate', 1, 2), piece('shield', 4, 2),
    piece('leather-helmet', 3, 1), piece('iron-helmet', 3, 5)];
  for (let count = 0; count <= 4; count++) {
    const layout = board([sword, ...armor.slice(0, count)]);
    assert.equal(getArthurBonus(sword, layout), Math.min(count, 3) * 5 / 100);
    assert.equal(damage(layout), Math.round(1.8 * (1 + Math.min(count, 3) * 0.05) * 1e6) / 1e6);
  }
});

test('cada armadura acende uma única estrela por arma mesmo com vários espaços de contato', () => {
  const sword = piece('sword', 2, 1);
  const shield = piece('shield', 3, 1);
  const layout = board([sword, shield]);
  const contacts = getActiveArthurStarCells(sword, layout);
  assert.equal(contacts.length, 1);
  assert.equal(getArthurBonus(sword, layout), 0.05);
  layout.items.push(piece('leather-chestplate', 0, 1));
  assert.equal(getActiveArthurStarCells(sword, layout).length, 2);
  assert.equal(getArthurBonus(sword, layout), 0.1);
  for (let turn = 0; turn < 4; turn++) {
    const weapon = { ...rotateFootprint(piece('bow', 2, 2), turn), x: 2, y: 2 };
    const armor = piece('iron-armor', 0, 2);
    const rotated = board([weapon, armor]);
    assert.ok(getActiveArthurStarCells(weapon, rotated).length <= 1);
  }
});

test('qualquer arma funciona, em qualquer giro, exclusivamente para Arthur e para ambos os lados', () => {
  for (const id of ['sword', 'iron-sword', 'bow', 'quick-daggers', 'hatchet', 'battle-axe', 'flaming-daggers']) {
    for (let turn = 0; turn < 4; turn++) {
      const weapon = { ...rotateFootprint(piece(id, 2, 2), turn), x: 2, y: 2 };
      const slot = getArthurStarCells(weapon, 'arthur').find(cell => cell.x >= 0 && cell.y >= 0);
      const helmet = { ...piece('leather-helmet', slot.x, slot.y), width: 1, height: 1 };
      const layout = board([weapon, helmet]);
      assert.equal(getArthurBonus(weapon, layout), 0.05, `${id} / ${turn}`);
      for (const side of ['player', 'enemy']) {
        assert.equal(damage(layout, side), Math.round(getCombatItem(weapon).damage * 1.05 * 1e6) / 1e6);
      }
      for (const classId of [null, 'another-class']) {
        assert.equal(damage(board([weapon, helmet], classId)), getCombatItem(weapon).damage);
        assert.deepEqual(getArthurStarCells(weapon, classId), []);
      }
    }
  }
});

test('diagonais, reserva e cristais defensivos não contam; remover armadura retira o bônus', () => {
  const sword = piece('sword', 2, 2);
  const layout = board([sword, piece('leather-helmet', 3, 1), piece('shield', null, null),
    piece('armored-crystal', 1, 2), piece('refined-iron', 3, 2)]);
  assert.equal(getArthurBonus(sword, layout), 0);
  const shield = piece('shield', 3, 3);
  layout.items.push(shield);
  assert.equal(getArthurBonus(sword, layout), 0.05);
  shield.x = null; shield.y = null;
  assert.equal(getArthurBonus(sword, layout), 0);
  assert.equal(getArthurBonus({ ...sword, x: null, y: null }, layout), 0);
});

test('estrelas seguem o perímetro do arco e uma armadura beneficia duas armas', () => {
  const bow = piece('bow', 2, 2);
  const stars = getArthurStarCells(bow, 'arthur');
  assert.equal(new Set(stars.map(cell => `${cell.x}:${cell.y}`)).size, stars.length);
  const sword = piece('sword', 0, 2);
  const shield = { ...piece('shield', 1, 2), width: 1, height: 1 };
  const layout = board([bow, sword, shield]);
  assert.equal(getArthurBonus(bow, layout), 0.05);
  assert.equal(getArthurBonus(sword, layout), 0.05);
  assert.ok(getActiveArthurStarCells(bow, layout).length);
  assert.deepEqual(getActiveArthurStarCells(bow, board([bow, shield], 'other')), []);
});

test('bônus multiplica o dano com suporte, sem aumentar queimadura, recarga ou gasto de estamina', () => {
  const weapon = piece('flaming-daggers', 2, 2);
  const layout = board([weapon, piece('whetstone', 1, 2), piece('shield', 3, 2)]);
  const fighter = new Combat(layout, layout).fighters.player;
  const stats = fighter.weapons[0];
  assert.equal(stats.damage, 1.785);
  assert.equal(stats.cooldown, getCombatItem(weapon).cooldown);
  assert.equal(stats.staminaCost, getCombatItem(weapon).staminaCost);
  assert.equal(stats.burnDamage, getCombatItem(weapon).burnDamage);
});

test('classe acompanha a jornada e o snapshot vencedor', () => {
  const session = new ShoppingSession({ classId: 'arthur' });
  assert.equal(session.board.classId, 'arthur');
  session.board.bags.push(piece('traveler-bag', 0, 0));
  session.board.items.push(piece('sword', 0, 0), piece('shield', 1, 0));
  session.wins = 9;
  session.beginBattle(); session.finishBattle('victory');
  assert.equal(session.winningBoard.classId, 'arthur');
  assert.equal(damage(session.winningBoard), 1.89);
});

test('dano aumentado chega aos golpes reais, inclusive críticos e ataques extras', () => {
  const layout = board([piece('sword', 0, 0), piece('shield', 1, 0)]);
  const enemy = board([], null);
  const combat = new Combat(layout, enemy, { random: () => 0 });
  const hits = combat.advance(2000).filter(event => event.type === 'attack' && event.side === 'player');
  assert.equal(hits.length, 2);
  assert.ok(hits.every(hit => hit.critical && hit.damage === 2.835));
  assert.ok(hits.some(hit => hit.extra));
  assert.equal(combat.fighters.enemy.health, 24.33);
});
