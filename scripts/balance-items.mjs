import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import Combat from '../src/systems/Combat.js';
import PackingBoard from '../src/systems/PackingBoard.js';
import { allItems } from '../src/data/shopCatalog.js';
import { combatItems, combatRules } from '../src/data/combatItems.js';
import { seededRandom } from '../src/utils/seededRandom.js';
import { getStarTargets } from '../src/utils/itemStars.js';

const count = Number(process.argv[2] ?? 100);
const mode = process.argv[3] ?? 'experiments';
assert.ok(Number.isInteger(count) && count > 0);
assert.ok(['experiments', 'stamina', 'iron', 'armor', 'damage', 'final'].includes(mode));
const catalog = new Map(allItems.map(item => [item.id, item]));
function board(entries, bagCount, budget) {
  const result = new PackingBoard({ columns: 8, rows: 8,
    bags: Array.from({ length: bagCount }, (_, i) => ({ ...catalog.get('traveler-bag'), id: `bag-${i}`, x: i * 4, y: 0 })),
    items: entries.map(([id, x, y], i) => ({ ...catalog.get(id), id: `${id}#${i}`, catalogId: id, x, y })),
  });
  assert.equal([...result.bags, ...result.items].reduce((sum, item) => sum + item.price, 0), budget);
  for (const item of result.items) {
    assert.equal(result.getPlacementError('item', item.id, item.x, item.y), null, item.catalogId);
    const stats = combatItems[item.catalogId];
    if (stats.weaponDamageBonus || stats.weaponCooldownMultiplier || stats.triggerArmorChance) {
      assert.ok(getStarTargets(item, result.items).some(target => combatItems[target.catalogId].damage
        || combatItems[target.catalogId].blockChance), `Inactive support: ${item.catalogId}`);
    }
  }
  return result;
}
const reference = JSON.parse(readFileSync('reports/revisao-apresentacao-experimento.json', 'utf8'));
const low = reference.builds.map((build, index) => ({ name: build.name, board: board(build.items.map((id, i) =>
  [id, ...(build.name === 'hatchets' && i === 1 ? [1, 1] : reference.layout.itemPositions[index][i])]), 1, 14) }));
const supports = [ ['whetstone', 2, 1], ['haste-stone', 0, 0], ['shield', 5, 2], ['vigor-potion', 0, 3] ];
const high = [
  ['fire-support', [['flaming-daggers', 1, 0], ...supports]],
  ['iron-support', [['iron-sword', 1, 0], ...supports]],
  ['axe-support', [['battle-axe', 1, 0], ...supports]],
  ['hatchets-support', [['hatchet', 1, 0], ['hatchet', 3, 0], ...supports]],
  ['daggers-support', [['quick-daggers', 1, 0], ['quick-daggers', 3, 0], ...supports]],
  ['swords-support', [['sword', 1, 0], ['sword', 3, 0], ...supports]],
  ['bow-support', [['bow', 1, 0], ...supports, ['potion', 3, 3]]],
  ['double-fire', [['flaming-daggers', 1, 0], ['flaming-daggers', 3, 0], ['haste-stone', 2, 1], ['shield', 5, 2]]],
  ['double-axes', [['battle-axe', 1, 0], ['battle-axe', 3, 0], ['haste-stone', 2, 1], ['shield', 5, 2]]],
  ['double-iron', [['iron-sword', 1, 0], ['iron-sword', 3, 0], ['haste-stone', 2, 1], ['shield', 5, 2]]],
  ['defense', [['sword', 1, 0], ['refined-iron', 2, 1], ['iron-shield', 3, 0], ['regeneration-potion', 0, 2], ['vigor-potion', 4, 3]]],
  ['fire-defense', [['flaming-daggers', 1, 0], ['refined-iron', 2, 1], ['iron-shield', 3, 0], ['regeneration-potion', 0, 2]]],
  ['iron-defense', [['iron-sword', 1, 0], ['refined-iron', 2, 1], ['iron-shield', 3, 0], ['regeneration-potion', 0, 2]]],
  ['axe-defense', [['battle-axe', 1, 0], ['refined-iron', 2, 1], ['iron-shield', 3, 0], ['regeneration-potion', 0, 2]]],
  ['daggers-defense', [['quick-daggers', 1, 0], ['quick-daggers', 3, 0], ['refined-iron', 2, 1], ['iron-shield', 5, 2], ['regeneration-potion', 0, 2]]],
  ['hatchets-defense', [['hatchet', 1, 0], ['hatchet', 3, 0], ['refined-iron', 2, 1], ['iron-shield', 5, 2], ['regeneration-potion', 0, 2]]],
  ['swords-defense', [['sword', 1, 0], ['sword', 3, 0], ['refined-iron', 2, 1], ['iron-shield', 5, 2], ['regeneration-potion', 0, 2]]],
  ['bow-defense', [['bow', 1, 0], ['refined-iron', 2, 1], ['iron-shield', 3, 0], ['regeneration-potion', 0, 2], ['potion', 5, 0]]],
  ['fire-haste-stack', [['flaming-daggers', 1, 0], ['haste-stone', 0, 0], ['haste-stone', 0, 1], ['haste-stone', 2, 1], ['potion', 5, 0]]],
].map(([name, entries]) => ({ name, board: board(entries, 2, 28) }));

const originalItems = structuredClone(combatItems), originalRules = { ...combatRules };
const current = { burn: originalItems['flaming-daggers'].burnDamage,
  damage: originalItems['flaming-daggers'].damage,
  stamina: originalItems['flaming-daggers'].staminaCost,
  chance: originalItems['flaming-daggers'].burnChance,
  requiresUnblocked: originalItems['flaming-daggers'].burnRequiresUnblockedHit ?? false,
  shield: originalItems['iron-shield'].armor, cooldownMinimum: originalRules.weaponCooldownMinimum };
current.ironCooldown = originalItems['refined-iron'].triggerArmorCooldown ?? 0;
current.burnIgnoresArmor = originalItems['flaming-daggers'].burnIgnoresArmor ?? true;
const stages = mode === 'final' ? [
  { name: 'original', burn: 4, chance: 0.2, requiresUnblocked: false, shield: 6, cooldownMinimum: 0.7 },
  { name: 'implemented', ...current },
] : mode === 'damage' ? [
  { name: 'damage-16', damage: 1.6, stamina: 1, burnIgnoresArmor: true },
  { name: 'damage-14', damage: 1.4, stamina: 1, burnIgnoresArmor: true },
  { name: 'damage-12', damage: 1.2, stamina: 1, burnIgnoresArmor: true },
  { name: 'damage-12-stamina08', damage: 1.2, stamina: 0.8, burnIgnoresArmor: true },
  { name: 'damage-14-armor', damage: 1.4, stamina: 1, burnIgnoresArmor: false },
].map(stage => ({ burn: 2, chance: 0.2, requiresUnblocked: true, shield: 9, cooldownMinimum: 0.7, ...stage }))
  : mode === 'armor' ? [
  { name: 'burn-bypass', burn: 2, chance: 0.2, stamina: 1, requiresUnblocked: true, shield: 9, cooldownMinimum: 0.7, burnIgnoresArmor: true },
  { name: 'burn-armor', burn: 2, chance: 0.2, stamina: 1, requiresUnblocked: true, shield: 9, cooldownMinimum: 0.7, burnIgnoresArmor: false },
  { name: 'burn-armor-no-gate', burn: 2, chance: 0.2, stamina: 1, requiresUnblocked: false, shield: 9, cooldownMinimum: 0.7, burnIgnoresArmor: false },
  { name: 'burn-armor-stamina-08', burn: 2, chance: 0.2, stamina: 0.8, requiresUnblocked: true, shield: 9, cooldownMinimum: 0.7, burnIgnoresArmor: false },
] : mode === 'iron' ? [0, 0.5, 1, 2].map(ironCooldown => ({
  name: `iron-${ironCooldown}`, ironCooldown, stamina: 1, burn: 2, chance: 0.2,
  requiresUnblocked: true, shield: 9, cooldownMinimum: 0.7,
})) : mode === 'stamina' ? [0.5, 0.7, 0.8, 0.9, 1].map(stamina => ({
  name: `stamina-${stamina}`, stamina, burn: 2, chance: 0.2, requiresUnblocked: true, shield: 9, cooldownMinimum: 0.7,
})) : [
  { name: 'original', burn: 4, chance: 0.2, requiresUnblocked: false, shield: 6, cooldownMinimum: 0.7 },
  { name: 'burn-2', burn: 2, chance: 0.2, requiresUnblocked: false, shield: 6, cooldownMinimum: 0.7 },
  { name: 'shield-9', burn: 2, chance: 0.2, requiresUnblocked: false, shield: 9, cooldownMinimum: 0.7 },
  { name: 'block-counter', burn: 2, chance: 0.2, requiresUnblocked: true, shield: 9, cooldownMinimum: 0.7 },
  { name: 'chance-15', burn: 2, chance: 0.15, requiresUnblocked: true, shield: 9, cooldownMinimum: 0.7 },
  { name: 'haste-20', burn: 2, chance: 0.2, requiresUnblocked: true, shield: 9, cooldownMinimum: 0.8 },
];
const results = [];
try {
  for (const stage of stages) {
    Object.assign(combatItems['flaming-daggers'], { burnDamage: stage.burn, burnChance: stage.chance,
      burnRequiresUnblockedHit: stage.requiresUnblocked, staminaCost: stage.stamina ?? 0.5,
      damage: stage.damage ?? 1.6 });
    combatItems['flaming-daggers'].burnIgnoresArmor = stage.burnIgnoresArmor ?? true;
    combatItems['iron-shield'].armor = stage.shield;
    combatItems['refined-iron'].triggerArmorCooldown = stage.ironCooldown ?? 0;
    combatRules.weaponCooldownMinimum = stage.cooldownMinimum;
    for (const [tier, builds, focusNames] of [['14-gold', low, mode === 'final' ? low.map(b => b.name) : ['flame']],
      ['28-gold', high, mode === 'final' ? high.map(b => b.name)
        : ['iron', 'armor', 'damage'].includes(mode) ? ['fire-defense', 'defense', 'double-fire', 'fire-support'] : ['fire-support', 'double-fire']]]) {
      for (const name of focusNames) {
        const focus = builds.find(build => build.name === name);
        for (const enemy of builds.filter(build => build !== focus)) {
          const row = { stage: stage.name, tier, focus: name, opponent: enemy.name,
            combats: count * 2, wins: 0, defeats: 0, draws: 0, duration: 0, burnDamage: 0, healing: 0, generatedArmor: 0 };
          for (let seed = 1; seed <= count; seed++) for (const reverse of [false, true]) {
            const combat = new Combat(reverse ? enemy.board : focus.board, reverse ? focus.board : enemy.board,
              { random: seededRandom(seed * 7919 + (mode === 'final' ? 90371 : 17)) });
            const events = combat.advance(180000);
            assert.ok(combat.result);
            const side = reverse ? 'enemy' : 'player', target = reverse ? 'player' : 'enemy';
            if (combat.result === 'draw') row.draws++;
            else if (combat.result === (reverse ? 'defeat' : 'victory')) row.wins++;
            else row.defeats++;
            row.duration += combat.elapsedMs / 1000;
            for (const event of events) {
              if (event.type === 'burn' && event.side === target) row.burnDamage += event.healthDamage;
              if (event.type === 'heal' && event.side === side) row.healing += event.healing;
              if (event.type === 'armor' && event.side === side) row.generatedArmor += event.amount;
            }
          }
          row.winPercent = +(row.wins / row.combats * 100).toFixed(2);
          for (const key of ['duration', 'burnDamage', 'healing', 'generatedArmor']) row[key] = +(row[key] / row.combats).toFixed(3);
          results.push(row);
        }
      }
    }
    const subset = results.filter(row => row.stage === stage.name);
    console.log(JSON.stringify({ stage: stage.name, summaries: ['flame', 'fire-support', 'double-fire', 'fire-defense', 'defense'].map(focus => {
      const rows = subset.filter(row => row.focus === focus);
      if (!rows.length) return null;
      return { focus, meanMatchupWinPercent: +(rows.reduce((n, row) => n + row.winPercent, 0) / rows.length).toFixed(1),
        minWin: Math.min(...rows.map(row => row.winPercent)), maxWin: Math.max(...rows.map(row => row.winPercent)) };
    }).filter(Boolean) }));
  }
} finally {
  for (const key of Object.keys(combatItems)) combatItems[key] = originalItems[key];
  Object.assign(combatRules, originalRules);
}
const report = { count, mode, stages, originalItems, originalRules,
  totalCombats: results.reduce((sum, row) => sum + row.combats, 0),
  method: 'Fixed valid post-fusion boards; equal gold and capacity within each tier; paired seeds and both sides. Mean matchup win percentages are descriptive, not campaign or population win rates. Final mode uses different seeds from candidate selection.',
  fixtures: { low, high }, results };
writeFileSync(`reports/balance-items-${mode}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(`Saved ${report.totalCombats} combats to reports/balance-items-${mode}.json`);
