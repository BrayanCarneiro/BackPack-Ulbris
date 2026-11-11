import test from 'node:test';
import assert from 'node:assert/strict';
import Combat from '../src/systems/Combat.js';
import { allItems } from '../src/data/shopCatalog.js';
import { rotateFootprint } from '../src/utils/rotation.js';

const piece = (id, x, y, turns = 0) => rotateFootprint({
  ...allItems.find(item => item.id === id), id, catalogId: id, x, y,
}, turns);
const emptyBoard = () => ({ bags: [], items: [] });
const covers = (item, cell) => item.x !== null && item.y !== null && (item.cells
  ? item.cells.some(offset => item.x + offset.x === cell.x && item.y + offset.y === cell.y)
  : cell.x >= item.x && cell.x < item.x + item.width && cell.y >= item.y && cell.y < item.y + item.height);
const overlaps = (a, b) => {
  for (let x = a.x; x < a.x + a.width; x++) {
    for (let y = a.y; y < a.y + a.height; y++) {
      if (covers(a, { x, y }) && covers(b, { x, y })) return true;
    }
  }
  return false;
};

// Expected positions are independent of getStarCells / getStarTargets.
const stoneStars = [
  [{ x: 2, y: 3 }, { x: 4, y: 3 }],
  [{ x: 3, y: 2 }, { x: 3, y: 4 }],
];
const chestStars = [
  [{ x: 2, y: 3 }, { x: 5, y: 3 }],
  [{ x: 3, y: 2 }, { x: 3, y: 5 }],
];

for (const supportId of ['whetstone', 'haste-stone', 'fire-stone', 'refined-iron', 'leather-chestplate', 'carmine-stone']) {
  test(`${supportId}: bônus restrito às estrelas em todas as posições, quatro giros e nos dois lados`, () => {
    const targetIds = supportId === 'leather-chestplate' ? ['shield', 'leather-helmet', 'armored-crystal', 'sword']
      : ['sword', 'bow', 'hatchet'];
    for (let turns = 0; turns < 4; turns++) {
      const support = piece(supportId, 3, 3, turns);
      const stars = supportId === 'carmine-stone'
        ? [[{ x: 4, y: 3 }], [{ x: 3, y: 4 }], [{ x: 2, y: 3 }], [{ x: 3, y: 2 }]][turns]
        : (supportId === 'leather-chestplate' ? chestStars : stoneStars)[turns % 2];
      for (const targetId of targetIds) {
        for (let targetTurns = 0; targetTurns < 4; targetTurns++) {
          for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
              const target = piece(targetId, x, y, targetTurns);
              if (x + target.width > 8 || y + target.height > 8 || overlaps(support, target)) continue;
              const onStar = stars.some(cell => covers(target, cell));
              for (const side of ['player', 'enemy']) {
                const board = { bags: [], items: [support, target] };
                const combat = new Combat(side === 'player' ? board : emptyBoard(),
                  side === 'enemy' ? board : emptyBoard(), { random: () => 0 });
                const fighter = combat.fighters[side];
                const context = `${supportId}(${turns}) → ${targetId}(${targetTurns}) @ ${x},${y}, ${side}`;
                if (supportId === 'refined-iron') {
                  const events = combat.activateStars(side, target.id);
                  assert.equal(events.length, onStar ? 1 : 0, context);
                } else if (supportId === 'leather-chestplate') {
                  const isArmor = ['shield', 'leather-helmet'].includes(targetId);
                  assert.equal(fighter.armorGenerators[0].amount, onStar && isArmor ? 3 : 0, context);
                } else {
                  const weapon = fighter.weapons[0];
                  const baseline = new Combat({ bags: [], items: [target] }, emptyBoard()).fighters.player.weapons[0];
                  assert.equal(weapon.damage, Number((baseline.damage + (onStar && supportId === 'whetstone' ? 0.3 : 0)).toFixed(6)), context);
                  assert.equal(weapon.cooldown, Number((baseline.cooldown * (onStar && supportId === 'haste-stone' ? 0.9 : 1)).toFixed(6)), context);
                  assert.equal(weapon.burnChance ?? 0, onStar && supportId === 'fire-stone' ? 0.1 : 0, context);
                  assert.equal(weapon.lifeStealChance ?? 0, onStar && supportId === 'carmine-stone' ? 0.05 : 0, context);
                }
              }
            }
          }
        }
      }
    }
  });
}

test('efeitos de estrelas ignoram fontes na reserva e não beneficiam o adversário', () => {
  for (const id of ['whetstone', 'haste-stone', 'fire-stone', 'refined-iron', 'leather-chestplate', 'carmine-stone']) {
    const stored = piece(id, null, null);
    const combat = new Combat({ bags: [], items: [stored, piece('sword', 4, 3)] },
      { bags: [], items: [piece('sword', 4, 3)] }, { random: () => 0 });
    for (const fighter of Object.values(combat.fighters)) {
      assert.equal(fighter.weapons[0].damage, 1.8);
      assert.equal(fighter.weapons[0].cooldown, 2);
      assert.equal(fighter.weapons[0].burnChance, undefined);
      assert.equal(fighter.weapons[0].lifeStealChance, undefined);
      assert.equal(fighter.armorGenerators.length, 0);
    }
    assert.deepEqual(combat.activateStars('player', 'sword'), []);
    assert.deepEqual(combat.activateStars('enemy', 'sword'), []);
    const active = new Combat({ bags: [], items: [piece(id, 3, 3), piece('sword', null, null)] },
      { bags: [], items: [piece('sword', 4, 3)] }, { random: () => 0 });
    assert.equal(active.fighters.enemy.weapons[0].damage, 1.8);
    assert.equal(active.fighters.enemy.weapons[0].cooldown, 2);
    assert.equal(active.fighters.enemy.weapons[0].burnChance, undefined);
    assert.equal(active.fighters.enemy.weapons[0].lifeStealChance, undefined);
    assert.deepEqual(active.activateStars('player', 'sword'), []);
    assert.deepEqual(active.activateStars('enemy', 'sword'), []);
    if (id === 'leather-chestplate') assert.equal(active.fighters.player.armorGenerators[0].amount, 0);
  }
});
