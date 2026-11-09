import test from 'node:test';
import assert from 'node:assert/strict';
import Combat from '../src/systems/Combat.js';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import { allItems, shopCatalog } from '../src/data/shopCatalog.js';
import { getItemDetails } from '../src/utils/itemDetails.js';
import { seededRandom } from '../src/utils/seededRandom.js';

const piece = (id, x = 0, y = 0, extra = {}) => ({
  ...allItems.find(item => item.id === id), catalogId: id, id, x, y, ...extra,
});
const board = (items = []) => ({ columns: 8, rows: 8, bags: [], items });
const fight = (items, enemies = [], random = () => 0.1) => new Combat(board(items), board(enemies), { random });
const newIds = ['quick-daggers', 'hatchet', 'bow', 'fire-stone', 'battle-axe', 'flaming-daggers'];

test('novos itens aparecem na loja ou na fusão, com atributos e receitas consultáveis', () => {
  for (const id of newIds) {
    assert.equal(allItems.filter(item => item.id === id).length, 1);
    const item = allItems.find(item => item.id === id);
    assert.equal(shopCatalog.some(item => item.id === id), item.acquisition !== 'fusion');
    const details = getItemDetails(id);
    assert.equal(details.itemClass.id, 'general');
    if (id !== 'fire-stone') {
      assert.equal(details.attributes.length, 6);
      assert.equal(details.effects.some(text => text.startsWith('Extras')), false);
    }
  }
  const flames = getItemDetails('flaming-daggers');
  assert.ok(flames.effects.some(text => text.includes('20%')));
  assert.ok(flames.effects.some(text => text.includes('2 de dano') && text.includes('2 turnos') && text.includes('1 segundo')));
  assert.ok(flames.effects.some(text => text.includes('não sejam totalmente bloqueados')));
  assert.equal(Object.fromEntries(flames.attributes)['Estamina por ataque'], '0,8');
  for (const id of ['quick-daggers', 'fire-stone', 'flaming-daggers']) {
    assert.ok(getItemDetails(id).recipes.some(recipe => recipe.result === 'flaming-daggers'));
  }
  assert.deepEqual(getItemDetails('hatchet').recipes[0].ingredients, ['hatchet', 'hatchet']);
});

test('cada nova arma ataca com o dano e a recarga próprios; itens guardados não atacam', () => {
  for (const [id, ms, damage] of [['quick-daggers', 1300, 1], ['hatchet', 3000, 3],
    ['bow', 2800, 3.4], ['battle-axe', 3200, 5.5], ['flaming-daggers', 1300, 1.4]]) {
    const combat = fight([piece(id)], [], () => 0.5);
    assert.deepEqual(combat.advance(ms - 100), []);
    assert.equal(combat.advance(100).find(event => event.type === 'attack').damage, damage);
    assert.equal(combat.fighters.enemy.health, 30 - damage);
    assert.equal(fight([piece(id, null, null)]).fighters.player.weapons.length, 0);
  }
});

test('queimadura exige acerto e respeita a fronteira exata dos 20%', () => {
  for (const roll of [0.199, 0.2]) {
    const rolls = [0.1, 0.9, 0.9, roll];
    const combat = fight([piece('flaming-daggers')], [], () => {
      assert.ok(rolls.length); return rolls.shift();
    });
    const events = combat.advance(1300);
    assert.equal(events.some(event => event.type === 'burn-applied'), roll < 0.2);
    assert.equal(combat.fighters.enemy.burns.length, roll < 0.2 ? 1 : 0);
  }
  const miss = fight([piece('flaming-daggers')], [], () => 0.99);
  assert.equal(miss.advance(1300).some(event => event.type === 'burn-applied'), false);
});

test('cada queimadura causa exatamente dois pulsos de dois, sem gastar armadura', () => {
  const combat = fight([piece('flaming-daggers')]);
  combat.fighters.enemy.armor = 9;
  const events = combat.advance(1300);
  assert.equal(events.find(event => event.type === 'attack').armorDamage, 1.4);
  assert.equal(combat.fighters.enemy.health, 30);
  combat.fighters.player.weapons[0].readyAt = Infinity;
  assert.equal(combat.advance(900).some(event => event.type === 'burn'), false);
  assert.equal(combat.advance(100).find(event => event.type === 'burn').healthDamage, 2);
  assert.equal(combat.fighters.enemy.health, 28);
  assert.equal(combat.fighters.enemy.armor, 7.6);
  assert.equal(combat.advance(1000).find(event => event.type === 'burn').healthDamage, 2);
  assert.equal(combat.fighters.enemy.burns.length, 0);
  assert.equal(combat.fighters.enemy.health, 26);
  assert.equal(combat.advance(2000).some(event => event.type === 'burn'), false);
});

test('acúmulos novos não renovam os antigos e desaparecem separadamente', () => {
  const combat = fight([piece('flaming-daggers')]);
  combat.advance(2600); // First stack at 1.3s; second at 2.6s.
  assert.equal(combat.fighters.enemy.burns.length, 2);
  combat.fighters.player.weapons[0].readyAt = Infinity;
  combat.advance(700); // First stack expires at 3.3s.
  assert.equal(combat.fighters.enemy.burns.length, 1);
  assert.equal(combat.fighters.enemy.burns[0].nextAt, 3.6);
  assert.equal(combat.advance(1300).filter(event => event.type === 'burn').length, 2);
  assert.equal(combat.fighters.enemy.burns.length, 0);
  assert.equal(combat.fighters.enemy.health, 19.2);
});

test('queimaduras letais simultâneas empatam, não revivem e param ao terminar a batalha', () => {
  const combat = fight([piece('flaming-daggers')], [piece('flaming-daggers'), piece('potion')]);
  // Avoid potion activation until the final lethal pulse.
  combat.fighters.enemy.potions[0].healthThreshold = 0;
  for (const fighter of Object.values(combat.fighters)) fighter.health = 5.4;
  combat.advance(1300);
  for (const fighter of Object.values(combat.fighters)) fighter.weapons[0].readyAt = Infinity;
  combat.advance(2000);
  assert.equal(combat.result, 'draw');
  assert.equal(combat.fighters.enemy.potions[0].consumed, false);
  assert.deepEqual(combat.advance(10000), []);
});

test('atordoamento de um segundo atrasa ataques e recargas, mas regenera estamina', () => {
  const combat = fight([piece('battle-axe')], [piece('bow')]);
  const enemy = combat.fighters.enemy;
  enemy.weapons[0].readyAt = 3.5;
  const events = combat.advance(3200);
  assert.equal(events.some(event => event.type === 'stun'), true);
  assert.equal(enemy.stunnedUntil, 4.2);
  assert.equal(enemy.weapons[0].readyAt, 4.5);
  enemy.stamina = 0;
  assert.equal(combat.advance(1000).some(event => event.type === 'attack'), false);
  assert.equal(enemy.stamina, 1);
  assert.equal(combat.advance(400).find(event => event.type === 'attack').side, 'enemy');
});

test('atordoamentos renovam a duração sem somar um segundo inteiro a cada aplicação', () => {
  const combat = fight([piece('battle-axe')], [piece('bow')]);
  combat.fighters.enemy.weapons[0].readyAt = 3.5;
  combat.advance(3200);
  combat.fighters.player.weapons[0].readyAt = 3.5;
  combat.fighters.player.stamina = 4.4;
  combat.advance(300);
  assert.equal(combat.fighters.enemy.stunnedUntil, 4.5);
  assert.equal(combat.fighters.enemy.weapons[0].readyAt, 4.8);
});

function shopping(ids) {
  const session = new ShoppingSession({ random: () => 0.5 });
  session.gold = 100;
  session.offers = ['traveler-bag', ...ids].map(id => ({ id, sold: false, locked: false }));
  for (const id of ['traveler-bag', ...ids]) assert.equal(session.buy(id), null);
  assert.equal(session.board.move('bag', 'traveler-bag', 0, 0), null);
  return session;
}

test('novas fusões exigem duas cópias distintas equipadas e uma batalha completa', () => {
  for (const result of ['victory', 'defeat', 'draw']) {
    for (const [ids, expected] of [[['hatchet', 'hatchet'], 'battle-axe'],
      [['quick-daggers', 'fire-stone'], 'flaming-daggers']]) {
      const session = shopping(ids);
      const [first, second] = session.board.items;
      session.board.move('item', first.id, 0, 0);
      assert.equal(session.board.move('item', second.id, 1, ids[0] === 'hatchet' ? 1 : 0), null);
      session.beginBattle();
      assert.equal(session.board.items.length, 2);
      const report = session.finishBattle(result);
      assert.equal(report.fusions, 1);
      assert.equal(session.board.items.length, 1);
      assert.equal(session.board.items[0].catalogId, expected);
      assert.equal(session.board.items[0].price, 6);
      const combat = new Combat(session.board, board());
      assert.equal(combat.fighters.player.weapons[0].damage, expected === 'battle-axe' ? 5.5 : 1.4);
      assert.equal(session.finishBattle(result), null);
    }
  }
  const single = shopping(['hatchet']);
  single.board.move('item', 'hatchet', 0, 0);
  single.beginBattle();
  assert.equal(single.finishBattle('victory').fusions, 0);
});

test('pedra girada funde adagas giradas; reserva, distância e cancelamento não fundem', () => {
  const session = shopping(['quick-daggers', 'fire-stone']);
  assert.equal(session.board.move('item', 'quick-daggers', 0, 1, 1), null);
  assert.equal(session.board.move('item', 'fire-stone', 0, 2, 1), null);
  session.beginBattle();
  assert.equal(session.finishBattle('victory').fusions, 1);
  const item = session.board.items[0];
  assert.deepEqual([item.catalogId, item.x, item.y, item.width, item.height, item.rotation],
    ['flaming-daggers', 0, 1, 2, 1, 90]);
  for (const mode of ['stored', 'far', 'cancel']) {
    const other = shopping(['quick-daggers', 'fire-stone']);
    other.board.move('item', 'quick-daggers', 0, 0);
    if (mode !== 'stored') other.board.move('item', 'fire-stone', mode === 'far' ? 3 : 1, 0);
    other.beginBattle();
    if (mode === 'cancel') other.cancelBattle();
    assert.equal(other.finishBattle('victory')?.fusions ?? 0, 0);
    assert.equal(other.board.items.length, 2);
  }
});

test('três machadinhas nunca reutilizam uma peça em duas fusões', () => {
  const session = shopping(['hatchet', 'hatchet', 'hatchet']);
  session.board.items.forEach((item, i) => {
    const [x, y] = [[0, 0], [1, 1], [2, 2]][i];
    assert.equal(session.board.move('item', item.id, x, y), null);
  });
  session.beginBattle();
  assert.equal(session.finishBattle('victory').fusions, 1);
  assert.equal(session.board.items.length, 2);
});

test('queimadura e atordoamento produzem os mesmos eventos em 1x, 2x, 3x e frames irregulares', () => {
  function simulate(frames) {
    const combat = fight([piece('flaming-daggers'), piece('battle-axe', 2)],
      [piece('flaming-daggers'), piece('battle-axe', 2)], seededRandom(2));
    const events = [];
    for (let i = 0; i < 10000 && !combat.result; i++) events.push(...combat.advance(frames[i % frames.length]));
    assert.ok(combat.result);
    return { events, fighters: combat.fighters, result: combat.result, time: combat.elapsedMs };
  }
  const expected = simulate([1000 / 60]);
  assert.ok(expected.events.some(event => event.type === 'burn'));
  assert.ok(expected.events.some(event => event.type === 'stun'));
  for (const frames of [[2000 / 60], [3000 / 60], [16, 33, 150, 1000]]) {
    assert.deepEqual(simulate(frames), expected);
  }
});
