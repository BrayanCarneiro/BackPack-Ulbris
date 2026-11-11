import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import Combat from '../src/systems/Combat.js';
import PackingBoard from '../src/systems/PackingBoard.js';
import { allItems } from '../src/data/shopCatalog.js';
import { combatItems } from '../src/data/combatItems.js';
import { seededRandom } from '../src/utils/seededRandom.js';

const baselinePath = 'reports/stages-balance-baseline.json';
const mode = process.argv[2] ?? 'select';
const seedBatch = Number(process.argv[3] ?? 0);
assert.ok(Number.isSafeInteger(seedBatch) && seedBatch >= 0 && seedBatch <= 10);
assert.ok(['select', 'refine', 'validate'].includes(mode));
const report = JSON.parse(readFileSync('reports/stages-300.json', 'utf8'));
const catalog = new Map(allItems.map(item => [item.id, item]));
// Preserve the exact pre-adjustment parameters for later reproduction.
let baseline;
if (mode === 'select' && !existsSync(baselinePath)) {
  baseline = structuredClone(combatItems);
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + '\n');
} else baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const current = structuredClone(combatItems);
const candidates = mode === 'refine' ? [
  { id: 'before', patch: {} },
  { id: 'bow-stamina-2', patch: { bow: { staminaCost: 2 } } },
  { id: 'shield-35', patch: { 'iron-shield': { blockChance: 0.35 } } },
  { id: 'shield-35-armor-8', patch: { 'iron-shield': { blockChance: 0.35, armor: 8 } } },
  { id: 'iron-stamina', patch: { 'iron-sword': { staminaCost: 1.8 } } },
  { id: 'targeted', patch: { bow: { staminaCost: 2 }, 'battle-axe': { staminaCost: 2 },
    'iron-shield': { blockChance: 0.35 }, 'fire-stone': { weaponBurnChance: 0.1 } } },
  { id: 'targeted-iron', patch: { bow: { staminaCost: 2 }, 'battle-axe': { staminaCost: 2 },
    'iron-shield': { blockChance: 0.35 }, 'iron-sword': { staminaCost: 1.8 }, 'fire-stone': { weaponBurnChance: 0.1 } } },
  { id: 'targeted-armor', patch: { bow: { staminaCost: 2 }, 'battle-axe': { staminaCost: 2 },
    'iron-shield': { blockChance: 0.35, armor: 8 }, 'iron-sword': { staminaCost: 1.8 }, 'fire-stone': { weaponBurnChance: 0.1 } } },
  { id: 'targeted-generation', patch: { bow: { staminaCost: 2 }, 'battle-axe': { staminaCost: 2 },
    'iron-shield': { blockChance: 0.35 }, 'iron-armor': { starArmorAmount: 3 },
    'iron-sword': { staminaCost: 1.8 }, 'fire-stone': { weaponBurnChance: 0.1 } } },
] : mode === 'validate' ? [
  { id: 'before', patch: baseline }, { id: 'applied', patch: current },
] : [
  { id: 'before', patch: {} },
  { id: 'bow-stamina', patch: { bow: { staminaCost: 1.7 } } },
  { id: 'bow-damage', patch: { bow: { damage: 3 } } },
  { id: 'armor-amount', patch: { 'iron-armor': { starArmorAmount: 3 } } },
  { id: 'armor-interval', patch: { 'iron-armor': { starArmorInterval: 7.5 } } },
  { id: 'axe-stamina', patch: { 'battle-axe': { staminaCost: 2 } } },
  { id: 'fire-chance', patch: { 'fire-stone': { weaponBurnChance: 0.1 } } },
  { id: 'shield-chance', patch: { 'iron-shield': { blockChance: 0.4 } } },
  { id: 'combined-amount', patch: { bow: { damage: 3.1, staminaCost: 1.6 },
    'iron-armor': { starArmorAmount: 3 }, 'battle-axe': { staminaCost: 2 } } },
  { id: 'combined-interval', patch: { bow: { damage: 3.1, staminaCost: 1.6 },
    'iron-armor': { starArmorInterval: 7.5 }, 'battle-axe': { staminaCost: 2 } } },
  { id: 'combined-shield', patch: { bow: { damage: 3.1, staminaCost: 1.6 },
    'iron-armor': { starArmorAmount: 3 }, 'iron-shield': { blockChance: 0.4 }, 'battle-axe': { staminaCost: 2 } } },
];

const fixture = (id, x, y) => ({ ...catalog.get(id), id, catalogId: id, x, y });
function controlled(weapon) {
  const board = { columns: 8, rows: 8,
    bags: [fixture('traveler-bag', 0, 0), { ...fixture('traveler-bag', 4, 0), id: 'bag-2' }],
    items: [fixture(weapon, 1, 0), fixture('haste-stone', 0, 1), fixture('whetstone', 2, 1),
      fixture('shield', 4, 0), fixture('regeneration-potion', 6, 0), fixture('vigor-potion', 7, 0),
      fixture('vital-crystal', 6, 2), ...(weapon === 'bow' ? [fixture('potion', 7, 1)] : [])] };
  const packing = new PackingBoard(board);
  for (const piece of packing.items) assert.equal(packing.getPlacementError('item', piece.id, piece.x, piece.y), null);
  assert.equal([...board.bags, ...board.items].reduce((sum, piece) => sum + piece.price, 0), 36);
  return { id: weapon, name: catalog.get(weapon).name, board };
}
const stages = [...report.fixtures, { id: 'controlled', budget: 36,
  builds: ['bow', 'iron-sword', 'battle-axe', 'flaming-daggers'].map(controlled) }];
const repeats = mode === 'validate' ? 100 : 50;
const original = structuredClone(combatItems);
const results = [];
try {
  for (const candidate of candidates) {
    for (const id of Object.keys(combatItems)) combatItems[id] = structuredClone(baseline[id]);
    for (const [id, patch] of Object.entries(candidate.patch)) Object.assign(combatItems[id], patch);
    const parameters = structuredClone(combatItems);
    const stageResults = [];
    for (const [stageIndex, stage] of stages.entries()) {
      const rows = stage.builds.map(build => ({ id: build.id, name: build.name, fights: 0,
        wins: 0, defeats: 0, draws: 0, armorGenerated: 0, healing: 0, seconds: 0 }));
      const matchups = [];
      for (let a = 0; a < stage.builds.length; a++) for (let b = a + 1; b < stage.builds.length; b++) {
        const matchup = { a: stage.builds[a].id, b: stage.builds[b].id, winsA: 0, winsB: 0, draws: 0 };
        for (let index = 0; index < repeats; index++) {
          const seed = (mode === 'validate' ? 144001211 : 81172021) + seedBatch * 100000007
            + stageIndex * 10000019 + a * 100003 + b * 1009 + index * 7919;
          const reverse = index % 2 === 1;
          const combat = new Combat(stage.builds[reverse ? b : a].board, stage.builds[reverse ? a : b].board,
            { random: seededRandom(seed) });
          const events = combat.advance(180000);
          assert.ok(combat.result);
          const winner = combat.result === 'draw' ? null : combat.result === (reverse ? 'defeat' : 'victory') ? a : b;
          if (winner === null) matchup.draws++;
          else if (winner === a) matchup.winsA++;
          else matchup.winsB++;
          for (const index of [a, b]) {
            const row = rows[index], side = index === (reverse ? b : a) ? 'player' : 'enemy';
            row.fights++;
            row.seconds += combat.elapsedMs / 1000;
            if (winner === null) row.draws++;
            else if (winner === index) row.wins++;
            else row.defeats++;
            for (const event of events) {
              if (event.side !== side) continue;
              if (event.type === 'armor') row.armorGenerated += event.amount;
              if (event.type === 'heal') row.healing += event.healing;
            }
          }
        }
        matchups.push(matchup);
      }
      for (const row of rows) {
        row.winPercent = Math.round(row.wins / row.fights * 10000) / 100;
        for (const key of ['seconds', 'armorGenerated', 'healing']) row[key] = Math.round(row[key] / row.fights * 1000) / 1000;
      }
      stageResults.push({ id: stage.id, budget: stage.budget, builds: rows, matchups });
    }
    const result = { candidate: candidate.id, parameters, stages: stageResults };
    results.push(result);
    console.log(JSON.stringify({ candidate: candidate.id, stages: stageResults.map(stage => ({
      id: stage.id, builds: stage.builds.map(build => ({ id: build.id, wins: build.winPercent })) })) }));
  }
} finally {
  for (const id of Object.keys(original)) combatItems[id] = original[id];
}
const totalFights = results.reduce((sum, result) => sum + result.stages.reduce((sum, stage) =>
  sum + stage.builds.reduce((sum, build) => sum + build.fights, 0) / 2, 0), 0);
writeFileSync(`reports/stages-balance-${mode}${seedBatch ? `-${seedBatch}` : ''}.json`, JSON.stringify({ mode, seedBatch, totalFights, repeats,
  method: 'Mesmas posições e composições da triagem. Orçamento igual por fase. Painel adicional de 36 ouro compara armas com o mesmo pacote; o arco recebe uma poção de vida de 2 ouro para compensar seu preço menor. Sementes pareadas entre variantes; metade das lutas de cada lado. Validação usa sementes novas. As repetições entre variantes não são observações independentes. Não simula ofertas e jornadas.',
  references: ['https://steamcommunity.com/app/2427700/announcements/'], controlledBoards: stages.at(-1).builds,
  results }, null, 2) + '\n');
console.log(`Saved ${totalFights} complete fights (${mode}).`);
