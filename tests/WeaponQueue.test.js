import test from 'node:test';
import assert from 'node:assert/strict';
import Combat from '../src/systems/Combat.js';
import { combatRules, getCombatItem } from '../src/data/combatItems.js';

const board = ids => ({
  bags: [{ id: 'bag', catalogId: 'traveler-bag', x: 0, y: 0, width: 4, height: 4 }],
  items: ids.map((catalogId, i) => ({ id: `weapon-${i}`, catalogId, x: i, y: 0, width: 1, height: 3 })),
});

for (const catalogId of ['sword', 'iron-sword']) {
  test(`três ${catalogId} continuam atacando dos dois lados sem energia extra`, () => {
    const equipment = board([catalogId, catalogId, catalogId]);
    // Misses keep a 40-second fight alive without introducing extra attacks.
    const combat = new Combat(equipment, equipment, { random: () => 0.99 });
    const timelines = { player: new Map(), enemy: new Map() };
    const stats = getCombatItem({ catalogId });
    for (let tick = 0; tick < 400; tick++) {
      const before = Object.fromEntries(Object.entries(combat.fighters).map(([side, f]) => [side, f.stamina]));
      const attacks = combat.advance(100).filter(event => event.type === 'attack');
      for (const attack of attacks) {
        const times = timelines[attack.side].get(attack.itemId) ?? [];
        times.push(combat.elapsedMs / 1000);
        timelines[attack.side].set(attack.itemId, times);
      }
      for (const [side, fighter] of Object.entries(combat.fighters)) {
        const spent = attacks.filter(event => event.side === side).length * stats.staminaCost;
        const expected = Math.min(fighter.maxStamina, before[side] + combatRules.staminaPerSecond * 0.1) - spent;
        assert.ok(Math.abs(fighter.stamina - expected) < 1e-6);
      }
    }
    assert.equal(combat.result, null);
    for (const [side, fighter] of Object.entries(combat.fighters)) {
      assert.deepEqual(fighter.weapons.map(w => w.id), equipment.items.map(w => w.id));
      const counts = [];
      for (const item of equipment.items) {
        const times = timelines[side].get(item.id);
        const minimumAttacks = Math.floor((40 - stats.cooldown) / (stats.staminaCost * 3));
        assert.ok(times.length >= minimumAttacks, `${side}: ${item.id} precisa continuar atacando`);
        assert.ok(times.at(-1) >= 35, `${side}: ${item.id} não pode parar após os primeiros ataques`);
        for (let i = 1; i < times.length; i++) {
          assert.ok(times[i] - times[i - 1] >= stats.cooldown - 1e-6);
          assert.ok(times[i] - times[i - 1] <= stats.staminaCost * 3 + 0.1 + 1e-6);
        }
        counts.push(times.length);
      }
      assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
    }
  });
}

test('arma mais barata espera a energia da arma que já estava na fila', () => {
  const combat = new Combat(board(['sword', 'iron-sword']), board([]), { random: () => 0.99 });
  const [cheap, expensive] = combat.fighters.player.weapons;
  combat.fighters.player.stamina = 0;
  cheap.readyAt = 1;
  expensive.readyAt = 0;
  // At 1.2 seconds the cheaper sword could attack, but the iron sword was ready first.
  assert.deepEqual(combat.advance(1200), []);
  assert.equal(combat.fighters.player.stamina, 1.2);
  const first = combat.advance(Math.round((expensive.staminaCost - 1.2) * 1000)).filter(event => event.type === 'attack');
  assert.deepEqual(first.map(event => event.itemId), [expensive.id]);
  assert.equal(combat.fighters.player.stamina, 0);
  const next = combat.advance(1200).filter(event => event.type === 'attack');
  assert.deepEqual(next.map(event => event.itemId), [cheap.id]);
});

test('fila com armas de custos diferentes independe do tamanho dos frames', () => {
  const equipment = board(['sword', 'iron-sword', 'sword']);
  const large = new Combat(equipment, equipment, { random: () => 0.99 });
  const small = new Combat(equipment, equipment, { random: () => 0.99 });
  const expected = large.advance(40000);
  const actual = [];
  for (let i = 0; i < 400; i++) actual.push(...small.advance(100));
  assert.deepEqual(actual, expected);
  assert.deepEqual(small.fighters, large.fighters);
  for (const side of ['player', 'enemy']) {
    for (const weapon of equipment.items) {
      assert.ok(actual.filter(e => e.type === 'attack' && e.side === side && e.itemId === weapon.id).length >= 8);
    }
  }
});
