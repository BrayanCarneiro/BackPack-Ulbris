import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import Combat from '../src/systems/Combat.js';
import { createOpponent } from '../src/data/opponents.js';
import { shopAutomatically } from '../src/systems/AutoShopper.js';
import { seededRandom } from '../src/utils/seededRandom.js';
import { combatItems, combatRules } from '../src/data/combatItems.js';

const count = Number(process.argv[2] ?? 300);
const batch = Number(process.argv[3] ?? 0);
const variant = process.argv[4] ?? 'current';
assert.ok(['current', 'rebalance-before', 'rebalance-after', 'stages-before', 'stages-after', 'rarity-before', 'rarity-after'].includes(variant));
// Diagnostic only: reproduce the old uniform shop with current combat values.
// Both player and NPC sessions use the same process-local rule.
if (variant === 'rarity-before') ShoppingSession.prototype.refreshOffers = function () {
  this.offers = this.offers.map(offer => {
    if (offer.locked && !offer.sold) return offer;
    const index = Math.min(this.catalog.length - 1, Math.floor(this.random() * this.catalog.length));
    return { id: this.catalog[index].id, sold: false, locked: false };
  });
};
if (variant === 'stages-before') {
  const baseline = JSON.parse(readFileSync('reports/stages-balance-baseline.json', 'utf8'));
  for (const [id, stats] of Object.entries(baseline)) combatItems[id] = stats;
}
if (variant === 'rebalance-before') {
  Object.assign(combatItems['flaming-daggers'], { damage: 1.6, staminaCost: 0.5, burnDamage: 4, burnRequiresUnblockedHit: false });
  combatItems['iron-shield'].armor = 6;
}
const parameters = { combatRules: structuredClone(combatRules), combatItems: structuredClone(combatItems),
  shopRarityMode: variant === 'rarity-before' ? 'uniform' : 'weighted' };
assert.ok(Number.isInteger(count) && count > 0);
assert.ok(Number.isInteger(batch) && batch >= 0);
const skills = ['beginner', 'intermediate', 'expert'];
const runs = [];
for (const skill of skills) {
  for (let index = 0; index < count; index++) {
    const seed = 190000 + index * 7919 + batch * 10000019;
    const session = new ShoppingSession({ random: seededRandom(seed), classId: 'arthur', opponentSeed: (index + batch * 7) % 32 });
    const battles = [];
    while (!session.runResult) {
      const actions = shopAutomatically(session, { skill });
      assert.equal(session.getCompletionError(), null);
      for (const item of session.board.items) assert.equal(session.board.getPlacementError('item', item.id, item.x, item.y), null);
      assert.ok(session.gold >= 0);
      const opponent = createOpponent(session.round, session.opponentSeed);
      const playerBoard = structuredClone(session.board);
      const battleSeed = seed + session.round * 104729;
      session.beginBattle();
      const combat = new Combat(session.board, opponent.board, { random: seededRandom(battleSeed) });
      combat.advance(180000);
      assert.ok(combat.result);
      const reverse = new Combat(opponent.board, session.board, { random: seededRandom(battleSeed) });
      reverse.advance(180000);
      const report = session.finishBattle(combat.result);
      battles.push({ round: report.round, actions, result: combat.result, reversedResult: { victory: 'defeat', defeat: 'victory', draw: 'draw' }[reverse.result],
        playerBoard, opponent: { profile: opponent.profile, board: opponent.board, gold: opponent.gold }, fusions: report.fusionNames, gold: session.gold });
    }
    runs.push({ skill, index, seed, roster: session.opponentSeed, result: session.runResult, wins: session.wins, battles });
  }
  console.log(`${skill}: ${runs.filter(r => r.skill === skill && r.result === 'victory').length}/${count}`);
}
function tally(battles) {
  return { battles: battles.length, victories: battles.filter(b => b.result === 'victory').length,
    defeats: battles.filter(b => b.result === 'defeat').length, draws: battles.filter(b => b.result === 'draw').length,
    reversedVictories: battles.filter(b => b.reversedResult === 'victory').length };
}
const summary = skills.map(skill => {
  const subset = runs.filter(r => r.skill === skill);
  const battles = subset.flatMap(r => r.battles);
  const victories = subset.filter(r => r.result === 'victory').length;
  return { skill, journeys: count, journeyVictories: victories, winRate: +(100 * victories / count).toFixed(2), averageWins: +(subset.reduce((n, r) => n + r.wins, 0) / count).toFixed(2),
    ...tally(battles), stages: { early: tally(battles.filter(b => b.round <= 3)), middle: tally(battles.filter(b => b.round >= 4 && b.round <= 7)), late: tally(battles.filter(b => b.round >= 8)) },
    rounds: Array.from({ length: 11 }, (_, i) => ({ round: i + 1, ...tally(battles.filter(b => b.round === i + 1)) })) };
});
mkdirSync('reports', { recursive: true });
const destination = `reports/balance-calibrated-${count}-${batch}${variant === 'current' ? '' : `-${variant}`}`;
writeFileSync(`${destination}.json`, JSON.stringify({ count, batch, variant, parameters, summary }, null, 2));
writeFileSync(`${destination}.json.gz`, gzipSync(JSON.stringify({ count, batch, variant, parameters, summary, runs })));
console.log(JSON.stringify(summary.map(({ rounds, ...rest }) => rest), null, 2));
