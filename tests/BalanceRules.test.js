import test from 'node:test';
import assert from 'node:assert/strict';
import Combat from '../src/systems/Combat.js';
import { allItems } from '../src/data/shopCatalog.js';
import { getItemDetails } from '../src/utils/itemDetails.js';
import { combatItems } from '../src/data/combatItems.js';

const item = (id, extra = {}) => ({ ...allItems.find(item => item.id === id), catalogId: id, id, x: 0, y: 0, ...extra });
const board = items => ({ bags: [], items });

test('bloqueio total impede a queimadura; bloqueio parcial e dano na armadura ainda permitem aplicação', () => {
  const full = new Combat(board([item('flaming-daggers')]), board([item('shield')]), { random: () => 0.1 });
  const events = full.advance(1300);
  assert.equal(events.find(event => event.type === 'attack').blocked, 1.4);
  assert.equal(events.some(event => event.type === 'burn-applied'), false);
  assert.equal(full.fighters.enemy.burns.length, 0);
  const rolls = [0.1, 0.01, 0.9, 0.1, 0.9, 0.1];
  const partial = new Combat(board([item('flaming-daggers')]), board([item('shield')]), {
    random: () => { assert.ok(rolls.length); return rolls.shift(); },
  });
  const attacks = partial.advance(1300);
  assert.equal(attacks.find(event => event.type === 'attack').damage, 2.1);
  assert.equal(attacks.find(event => event.type === 'attack').blocked, 1.8);
  assert.equal(attacks.some(event => event.type === 'burn-applied'), true);
  assert.equal(partial.fighters.enemy.health, 30);
  assert.equal(partial.fighters.enemy.burns.length, 1);
});

test('duas adagas flamejantes disputam estamina; uma isolada mantém a cadência base', () => {
  function simulate(copies) {
    const input = board(Array.from({ length: copies }, (_, i) => item('flaming-daggers', { id: `flames-${i}` })));
    const combat = new Combat(input, board([]), { random: () => 0.5 });
    combat.fighters.enemy.health = 10000;
    return combat.advance(30000).filter(event => event.type === 'attack');
  }
  const single = simulate(1), double = simulate(2);
  assert.equal(single.length, 23);
  assert.ok(double.length < single.length * 2, 'Two weapons must eventually exhaust the initial stamina');
  assert.ok(double.some(event => event.itemId === 'flames-0'));
  assert.ok(double.some(event => event.itemId === 'flames-1'));
});

test('a evolução do escudo preserva proteção inicial e melhora a chance de bloquear', () => {
  assert.equal(combatItems['iron-shield'].armor, combatItems.shield.armor);
  assert.ok(combatItems['iron-shield'].blockChance > combatItems.shield.blockChance);
  assert.equal(Object.fromEntries(getItemDetails('iron-shield').attributes)['Armadura inicial'], '+9');
});

test('limites de pedras mantêm a regra original e a ficha explica a multiplicação de celeridade', () => {
  const effects = getItemDetails('haste-stone').effects.join(' ');
  assert.ok(effects.includes('30%') && effects.includes('19%') && effects.includes('27,1%'));
  assert.ok(getItemDetails('whetstone').effects.some(text => text.includes('+0,9')));
  assert.equal(combatItems['regeneration-potion'].regeneration, 1.2);
  assert.equal(combatItems['vital-crystal'].health, 4);
});
