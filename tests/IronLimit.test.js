import test from 'node:test';
import assert from 'node:assert/strict';
import Combat from '../src/systems/Combat.js';
import { allItems } from '../src/data/shopCatalog.js';
import { getItemDetails } from '../src/utils/itemDetails.js';

const item = (id, x, y, extra = {}) => ({ ...allItems.find(piece => piece.id === id),
  catalogId: id, id, x, y, ...extra });
const board = (items = []) => ({ bags: [], items });
function surrounded(id) {
  const target = item(id, 2, 2);
  return [target,
    item('refined-iron', 1, 2, { id: 'iron-left' }),
    item('refined-iron', 2 + target.width, 2, { id: 'iron-right' }),
    item('refined-iron', 2, 1, { id: 'iron-top', rotation: 90 }),
    item('refined-iron', 2, 2 + target.height, { id: 'iron-bottom', rotation: 90 }),
  ];
}

test('qualquer item pode ativar somente dois ferros, nos dois lados', () => {
  for (const id of ['quick-daggers', 'sword', 'potion', 'shield', 'iron-armor']) {
    const combat = new Combat(board(surrounded(id)), board(surrounded(id)), { random: () => 0 });
    for (const side of ['player', 'enemy']) {
      assert.equal(combat.fighters[side].irons.filter(iron => iron.targets.includes(id)).length, 4);
      const initial = combat.fighters[side].armor;
      const events = combat.activateStars(side, id);
      assert.equal(events.length, 2, `${id}/${side}`);
      assert.equal(combat.fighters[side].armor, initial + 4.8);
    }
  }
  assert.ok(getItemDetails('refined-iron').effects.some(effect => effect.includes('máximo 2 Ferros')));
});

test('ferros excedentes não sorteiam quando os dois elegíveis falham', () => {
  let rolls = 0;
  const combat = new Combat(board(surrounded('quick-daggers')), board(), {
    random: () => { rolls++; return rolls <= 2 ? 0.99 : 0; },
  });
  assert.deepEqual(combat.activateStars('player', 'quick-daggers'), []);
  assert.equal(rolls, 2);
  assert.equal(combat.fighters.player.armor, 0);
});

test('o mesmo ferro pode reagir a cada lado no mesmo instante, com limite independente por item', () => {
  const items = [item('sword', 1, 1), item('sword', 3, 1, { id: 'second-sword' }),
    item('refined-iron', 2, 1), item('refined-iron', 2, 2, { id: 'second-iron' }),
    item('refined-iron', 0, 1, { id: 'extra-left-iron' }),
    item('refined-iron', 4, 1, { id: 'extra-right-iron' })];
  const combat = new Combat(board(items), board(), { random: () => 0 });
  const first = combat.activateStars('player', 'sword');
  const second = combat.activateStars('player', 'second-sword');
  assert.equal(first.length, 2);
  assert.equal(second.length, 2);
  assert.deepEqual(first.map(event => event.itemId), ['refined-iron', 'second-iron']);
  assert.deepEqual(second.map(event => event.itemId), ['refined-iron', 'second-iron']);
  assert.equal(combat.fighters.player.armor, 9.6);
});

test('limite também vale no combate real para ataques extras, poções e bloqueios', () => {
  const sword = new Combat(board(surrounded('sword')), board(), { random: () => 0 });
  const events = sword.advance(2000);
  assert.equal(events.filter(event => event.type === 'attack').length, 2);
  assert.equal(events.filter(event => event.type === 'armor').length, 4);
  const potion = new Combat(board(surrounded('potion')), board(), { random: () => 0 });
  potion.fighters.player.health = 10;
  assert.equal(potion.advance(100).filter(event => event.type === 'armor').length, 2);
  const shield = new Combat(board([item('quick-daggers', 0, 0)]), board(surrounded('shield')), { random: () => 0 });
  assert.equal(shield.advance(1300).filter(event => event.type === 'armor' && event.side === 'enemy').length, 2);
});

test('ativação periódica de armadura também respeita dois ferros e conserva seu bônus próprio', () => {
  const items = [item('iron-armor', 2, 2), item('iron-helmet', 0, 2),
    item('iron-helmet', 4, 2, { id: 'second-helmet' }),
    item('refined-iron', 1, 3), item('refined-iron', 4, 3, { id: 'iron-right' }),
    item('refined-iron', 2, 1, { id: 'iron-top', rotation: 90 }),
    item('refined-iron', 2, 5, { id: 'iron-bottom', rotation: 90 })];
  const combat = new Combat(board(items), board(), { random: () => 0 });
  const events = combat.advance(5900).filter(event => event.type === 'armor');
  assert.equal(events.length, 3);
  assert.equal(events[0].amount, 8);
  assert.equal(events.filter(event => event.sourceItemId === 'iron-armor').length, 2);
});
