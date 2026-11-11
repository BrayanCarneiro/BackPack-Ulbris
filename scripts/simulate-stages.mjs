import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import Combat from '../src/systems/Combat.js';
import PackingBoard from '../src/systems/PackingBoard.js';
import { allItems } from '../src/data/shopCatalog.js';
import { combatRules, getCombatItem } from '../src/data/combatItems.js';
import { itemRecipes } from '../src/data/itemRecipes.js';
import { seededRandom } from '../src/utils/seededRandom.js';
import { getStarTargets } from '../src/utils/itemStars.js';
import { rotateFootprint, getFootprintCells } from '../src/utils/rotation.js';

// Exactly 100 fights per stage: ten unordered pairs, ten independent seeds per pair.
// Each build plays 40 times, five times on each side against each opponent.
const catalog = new Map(allItems.map(item => [item.id, item]));
const layoutAttempts = 8000;
const stages = [
  { id: 'early', name: 'Início', budget: 14, bags: 1, round: 2, definitions: [
    { id: 'mixed', name: 'Espada e machadinha', ids: ['sword', 'hatchet', 'shield'] },
    { id: 'daggers', name: 'Duas adagas rápidas', ids: ['quick-daggers', 'quick-daggers', 'shield'] },
    { id: 'bow', name: 'Arco, escudo e vida', ids: ['bow', 'shield', 'potion'] },
    { id: 'fire', name: 'Adaga e pedra de fogo', ids: ['quick-daggers', 'fire-stone', 'shield'] },
    { id: 'sharp', name: 'Espada e amolar', ids: ['sword', 'whetstone', 'shield'] },
  ] },
  { id: 'mid', name: 'Meio', budget: 34, bags: 2, round: 4, definitions: [
    { id: 'red-fire', name: 'Fogo e cristal vermelho', ids: ['flaming-daggers', 'red-crystal', 'shield', 'regeneration-potion', 'haste-stone', 'vital-crystal'] },
    { id: 'blue-fire', name: 'Fogo e cristal azul', ids: ['flaming-daggers', 'blue-crystal', 'shield', 'regeneration-potion', 'haste-stone', 'vital-crystal'] },
    { id: 'iron', name: 'Espada e escudo de ferro', ids: ['iron-sword', 'iron-shield', 'regeneration-potion', 'whetstone', 'haste-stone', 'potion'] },
    { id: 'axes', name: 'Dois machados e estamina', ids: ['battle-axe', 'battle-axe', 'shield', 'vigor-potion', 'energy-crystal', 'white-crystal'] },
    { id: 'bows', name: 'Dois arcos e proteção crítica', ids: ['bow', 'bow', 'leather-helmet', 'shield', 'regeneration-potion', 'white-crystal', 'potion'] },
  ] },
  { id: 'late', name: 'Fim', budget: 70, bags: 2, round: 7, definitions: [
    { id: 'red-fortress', name: 'Fogo, vermelho e armadura', ids: ['flaming-daggers', 'flaming-daggers', 'iron-armor', 'iron-helmet', 'iron-shield', 'haste-stone', 'red-crystal', 'regeneration-potion', 'vigor-potion', 'blue-crystal', 'white-crystal', 'potion'] },
    { id: 'golden', name: 'Dourado e duas flamejantes', ids: ['golden-crystal', 'flaming-daggers', 'flaming-daggers', 'iron-shield', 'iron-helmet', 'haste-stone', 'regeneration-potion', 'vigor-potion', 'vital-crystal', 'whetstone', 'potion'] },
    { id: 'fortress', name: 'Fortaleza de ferro', ids: ['iron-armor', 'iron-helmet', 'iron-shield', 'iron-shield', 'iron-sword', 'iron-sword', 'haste-stone', 'regeneration-potion', 'protection-potion', 'vigor-potion', 'vital-crystal'] },
    { id: 'vampiric', name: 'Vampírico equilibrado', ids: ['vampiric-chestplate', 'iron-helmet', 'iron-shield', 'flaming-daggers', 'iron-sword', 'haste-stone', 'whetstone', 'regeneration-potion', 'vigor-potion', 'vital-crystal'] },
    { id: 'axes', name: 'Machados e cristais defensivos', ids: ['battle-axe', 'battle-axe', 'iron-helmet', 'iron-shield', 'haste-stone', 'whetstone', 'whetstone', 'regeneration-potion', 'vigor-potion', 'vigor-potion', 'energy-crystal', 'energy-crystal', 'black-crystal', 'white-crystal', 'potion'] },
  ] },
];

const cache = new Map();
function placements(id, width) {
  const key = `${id}:${width}`;
  if (cache.has(key)) return cache.get(key);
  const options = [];
  for (let turn = 0; turn < 4; turn++) {
    const shape = rotateFootprint(catalog.get(id), turn);
    for (let y = 0; y + shape.height <= 4; y++) for (let x = 0; x + shape.width <= width; x++) {
      let mask = 0;
      for (const cell of getFootprintCells(shape)) mask |= 1 << ((y + cell.y) * width + x + cell.x);
      options.push({ shape, x, y, mask });
    }
  }
  cache.set(key, options);
  return options;
}

function synergy(board) {
  let score = 0;
  for (const piece of board.items) {
    const stats = getCombatItem(piece);
    for (const target of getStarTargets(piece, board.items)) {
      const targetStats = getCombatItem(target);
      if (targetStats.damage) {
        if (stats.weaponCooldownMultiplier) score += 10;
        if (stats.weaponDamageBonus) score += 8;
        if (stats.weaponDamagePerBurn) score += 10;
        if (stats.weaponBurnChance) score += 5;
        if (stats.triggerArmorChance) score += 6;
      }
      if (stats.starArmorInterval && targetStats.isArmor) score += 10;
      if (stats.triggerArmorChance && targetStats.blockChance) score += 4;
      if (stats.triggerArmorChance && targetStats.starArmorInterval) score += 3;
    }
  }
  return score;
}

function ingredientCost(id, visited = new Set()) {
  assert.ok(!visited.has(id), `Recursive recipe: ${id}`);
  const recipe = itemRecipes.find(recipe => recipe.result === id);
  if (!recipe) return catalog.get(id).price;
  const path = new Set([...visited, id]);
  return recipe.ingredients.reduce((sum, id) => sum + ingredientCost(id, path), 0);
}

function build(definition, stage, seed) {
  const random = seededRandom(seed);
  const pieces = definition.ids.map((id, index) => {
    assert.ok(catalog.has(id), id);
    assert.equal(ingredientCost(id), catalog.get(id).price, `Ingredient cost: ${id}`);
    assert.ok(stage.id !== 'early' || !itemRecipes.some(recipe => recipe.result === id));
    return { id: `${id}#${index}`, catalogId: id, area: getFootprintCells(catalog.get(id)).length };
  });
  const bags = Array.from({ length: stage.bags }, (_, i) => ({ ...catalog.get('traveler-bag'),
    id: `bag#${i}`, catalogId: 'traveler-bag', x: i * 4, y: 0 }));
  let best;
  let validLayouts = 0;
  for (let attempt = 0; attempt < layoutAttempts; attempt++) {
    const ordered = pieces.map(piece => ({ ...piece, priority: piece.area + random() * 3 }))
      .sort((a, b) => b.priority - a.priority);
    let occupied = 0;
    const items = [];
    for (const piece of ordered) {
      const candidates = placements(piece.catalogId, stage.bags * 4).filter(option => !(option.mask & occupied));
      if (!candidates.length) break;
      const option = candidates[Math.floor(random() * candidates.length)];
      occupied |= option.mask;
      items.push({ ...option.shape, id: piece.id, catalogId: piece.catalogId, x: option.x, y: option.y });
    }
    if (items.length !== pieces.length) continue;
    validLayouts++;
    const board = { columns: 8, rows: 8, bags, items };
    const score = synergy(board);
    if (!best || score > best.score) best = { board, score };
  }
  assert.ok(best, `No legal packing: ${definition.name}`);
  const order = new Map(pieces.map((piece, index) => [piece.id, index]));
  best.board.items.sort((a, b) => order.get(a.id) - order.get(b.id));
  const validation = new PackingBoard(best.board);
  for (const piece of validation.items) {
    assert.equal(validation.getPlacementError('item', piece.id, piece.x, piece.y), null, `${definition.id}: ${piece.id}`);
  }
  const spent = [...bags, ...best.board.items].reduce((sum, piece) => sum + piece.price, 0);
  assert.equal(spent, stage.budget, `${definition.id}: budget`);
  const initial = new Combat(best.board, { bags: [], items: [] }).fighters.player;
  const supports = best.board.items.filter(piece => {
    const stats = getCombatItem(piece);
    return stats.weaponDamageBonus || stats.weaponDamagePerBurn || stats.weaponCooldownMultiplier
      || stats.weaponBurnChance || stats.starArmorInterval || stats.triggerArmorChance;
  }).map(piece => ({ id: piece.id, name: piece.name, targets: getStarTargets(piece, best.board.items)
    .filter(target => { const stats = getCombatItem(piece); return stats.starArmorInterval
      ? getCombatItem(target).isArmor : getCombatItem(target).damage || (stats.triggerArmorChance && getCombatItem(target).blockChance); })
    .map(target => ({ id: target.id, name: target.name })) }));
  assert.ok(supports.every(support => support.targets.length > 0), `Inactive stars: ${definition.id}`);
  console.log(JSON.stringify({ stage: stage.id, build: definition.name, spent, score: best.score, validLayouts,
    supports, armor: initial.armor, health: initial.health }));
  return { ...definition, ...best, spent, validLayouts, supports,
    initial: { health: initial.health, armor: initial.armor, stamina: initial.stamina, resistance: initial.resistance } };
}

const round = n => Math.round(n * 1000) / 1000;
function metrics() {
  return { healthDamage: 0, physicalHealthDamage: 0, burnHealthDamage: 0, fatigueHealthDamage: 0,
    armorAbsorbed: 0, armorGenerated: 0, healing: 0, vampiricHealing: 0, lastLightHealing: 0,
    lastLightActivations: 0, resistanceGenerated: 0, debuffsResisted: 0, burnApplications: 0,
    stunSecondsApplied: 0, maxBurnStacks: 0, redBonusBeforeBlock: 0, staminaWaitSeconds: 0 };
}

const battles = [];
const fixtures = [];
for (const [stageIndex, stage] of stages.entries()) {
  const builds = stage.definitions.map((definition, index) => build(definition, stage, 811711 + stageIndex * 100003 + index * 7919));
  fixtures.push({ ...stage, definitions: undefined, builds });
  for (let a = 0; a < builds.length; a++) for (let b = a + 1; b < builds.length; b++) {
    for (let index = 0; index < 10; index++) {
      const seed = 20261111 + stageIndex * 10000019 + a * 100003 + b * 1009 + index * 7919;
      const reversed = index % 2 === 1;
      const sideA = reversed ? 'enemy' : 'player';
      const sideB = reversed ? 'player' : 'enemy';
      const combat = new Combat(reversed ? builds[b].board : builds[a].board,
        reversed ? builds[a].board : builds[b].board, { random: seededRandom(seed) });
      const stats = { player: metrics(), enemy: metrics() };
      // Observers only: record the engine's decisions, without changing combat parameters.
      const apply = combat.applyAttack.bind(combat);
      combat.applyAttack = (attack, ...args) => {
        const weapon = combat.fighters[attack.side]?.weapons.find(piece => piece.id === attack.itemId);
        if (attack.hit && weapon?.damagePerBurn) {
          const stacks = combat.fighters[attack.target].burns.filter(burn => burn.remaining > 0).length;
          stats[attack.side].redBonusBeforeBlock += weapon.damagePerBurn * stacks
            * (attack.critical ? weapon.criticalMultiplier * combat.fighters[attack.target].criticalDamageMultiplier : 1);
        }
        return apply(attack, ...args);
      };
      const step = combat.step.bind(combat);
      combat.step = () => {
        for (const [side, fighter] of Object.entries(combat.fighters)) {
          const time = combat.elapsedMs / 1000;
          const queue = [...fighter.weapons].sort((a, b) => a.readyAt - b.readyAt);
          if (fighter.stunnedUntil <= time && queue[0]?.readyAt <= time
            && queue[0].staminaCost > Math.min(fighter.maxStamina, fighter.stamina + combatRules.staminaPerSecond * 0.1) + 1e-8) {
            stats[side].staminaWaitSeconds += 0.1;
          }
        }
        return step();
      };
      const events = combat.advance(180000);
      assert.ok(combat.result, 'Fight did not finish');
      for (const fighter of Object.values(combat.fighters)) {
        for (const field of ['health', 'armor', 'stamina', 'resistance']) {
          assert.ok(Number.isFinite(fighter[field]) && fighter[field] >= 0, `Invalid ${field}`);
        }
        assert.ok(fighter.health <= fighter.maxHealth && fighter.stamina <= fighter.maxStamina);
      }
      for (const event of events) {
        if (event.type === 'attack') {
          stats[event.side].healthDamage += event.healthDamage;
          stats[event.side].physicalHealthDamage += event.healthDamage;
          stats[event.target].armorAbsorbed += event.armorDamage;
        } else if (event.type === 'burn' || event.type === 'fatigue') {
          const source = event.type === 'burn' ? event.source : event.side;
          stats[source][event.type === 'burn' ? 'burnHealthDamage' : 'fatigueHealthDamage'] += event.healthDamage;
          if (event.type === 'burn') stats[source].healthDamage += event.healthDamage;
        } else if (event.type === 'heal') {
          stats[event.side].healing += event.healing;
          if (event.damageHealing) stats[event.side].vampiricHealing += event.healing;
          if (event.lastLight) { stats[event.side].lastLightHealing += event.healing; stats[event.side].lastLightActivations++; }
        } else if (event.type === 'armor') stats[event.side].armorGenerated += event.amount;
        else if (event.type === 'resistance') stats[event.side].resistanceGenerated += event.amount;
        else if (event.type === 'debuff-resisted') stats[event.side].debuffsResisted++;
        else if (event.type === 'stun') stats[event.source].stunSecondsApplied += event.seconds;
        else if (event.type === 'burn-applied') {
          stats[event.source].burnApplications++;
          stats[event.source].maxBurnStacks = Math.max(stats[event.source].maxBurnStacks, event.stacks);
        }
      }
      const winner = combat.result === 'draw' ? null : combat.result === 'victory' ? 'player' : 'enemy';
      battles.push({ stage: stage.id, a: builds[a].id, b: builds[b].id, seed, sideA, sideB,
        winner: winner === null ? null : winner === sideA ? builds[a].id : builds[b].id,
        seconds: combat.elapsedMs / 1000, fatigue: events.some(event => event.type === 'fatigue'),
        healthA: combat.fighters[sideA].health, healthB: combat.fighters[sideB].health,
        statsA: Object.fromEntries(Object.entries(stats[sideA]).map(([k, v]) => [k, round(v)])),
        statsB: Object.fromEntries(Object.entries(stats[sideB]).map(([k, v]) => [k, round(v)])) });
    }
  }
  assert.equal(battles.filter(battle => battle.stage === stage.id).length, 100);
}

const summaries = fixtures.map(stage => {
  const rows = battles.filter(battle => battle.stage === stage.id);
  return { id: stage.id, name: stage.name, budget: stage.budget, fights: rows.length,
    meanSeconds: round(rows.reduce((sum, row) => sum + row.seconds, 0) / rows.length),
    fatigueFights: rows.filter(row => row.fatigue).length,
    builds: stage.builds.map(build => {
      const appearances = rows.filter(row => row.a === build.id || row.b === build.id);
      const wins = appearances.filter(row => row.winner === build.id).length;
      const draws = appearances.filter(row => row.winner === null).length;
      const values = appearances.map(row => row.a === build.id ? row.statsA : row.statsB);
      return { id: build.id, name: build.name, fights: appearances.length, wins,
        defeats: appearances.length - wins - draws, draws, winPercent: round(wins / appearances.length * 100),
        meanSeconds: round(appearances.reduce((sum, row) => sum + row.seconds, 0) / appearances.length),
        averages: Object.fromEntries(Object.keys(metrics()).map(key => [key, round(values.reduce((sum, row) => sum + row[key], 0) / values.length)])),
        matchups: stage.builds.filter(enemy => enemy.id !== build.id).map(enemy => {
          const pair = appearances.filter(row => row.a === enemy.id || row.b === enemy.id);
          return { opponent: enemy.id, wins: pair.filter(row => row.winner === build.id).length,
            draws: pair.filter(row => row.winner === null).length, fights: pair.length };
        }) };
    }).sort((a, b) => b.winPercent - a.winPercent) };
});
const report = { totalFights: battles.length, layoutAttempts, rules: combatRules,
  method: 'Cinco builds predefinidas por fase. Cada um dos dez pares disputa dez sementes independentes, cinco de cada lado. Sementes não são duplicadas para espelhamento. Mesmo custo exato de ingredientes e mochilas e mesma capacidade dentro de cada fase. Encaixe escolhido por geometria e estrelas antes dos combates, sem consultar resultados. Builds prontas, incluindo resultados de fusão: ofertas, gasto com renovação, atraso para obter fusões e sobrevivência na jornada não foram simulados. Triagem descritiva, sem isolar a causa em um item nem provar equilíbrio geral.',
  fixtures, summaries, battles };
assert.equal(report.totalFights, 300);
mkdirSync('reports', { recursive: true });
writeFileSync('reports/stages-300.json', JSON.stringify(report, null, 2) + '\n');
const lines = ['# Início, meio e fim — 300 combates', '', report.method, '',
  'Sementes, composições, posições, estrelas e métricas por combate: `stages-300.json`.', ''];
for (const summary of summaries) {
  lines.push(`## ${summary.name}: ${summary.fights} combates, ${summary.budget} ouro`, '',
    `Duração média: ${summary.meanSeconds} s. Lutas com fadiga: ${summary.fatigueFights}/100.`, '',
    '| Build | V | D | E | Vitórias | Cura média | Armadura gerada | Dano de queimadura | Espera por estamina |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const build of summary.builds) lines.push(`| ${build.name} | ${build.wins} | ${build.defeats} | ${build.draws} | ${build.winPercent}% | ${build.averages.healing} | ${build.averages.armorGenerated} | ${build.averages.burnHealthDamage} | ${build.averages.staminaWaitSeconds} s |`);
  lines.push('', '### Composições', '');
  const fixture = fixtures.find(stage => stage.id === summary.id);
  for (const build of fixture.builds) {
    const counts = new Map();
    for (const piece of build.board.items) counts.set(piece.name, (counts.get(piece.name) ?? 0) + 1);
    lines.push(`- **${build.name}:** ${fixture.bags} Mochila(s) viajante(s); ${[...counts].map(([name, n]) => `${n}× ${name}`).join(', ')}.`);
  }
  lines.push('', '### Confrontos (10 lutas por par)', '');
  for (let a = 0; a < fixture.builds.length; a++) for (let b = a + 1; b < fixture.builds.length; b++) {
    const first = fixture.builds[a], second = fixture.builds[b];
    const pair = battles.filter(row => row.stage === summary.id && row.a === first.id && row.b === second.id);
    lines.push(`- ${first.name} × ${second.name}: **${pair.filter(row => row.winner === first.id).length}–${pair.filter(row => row.winner === second.id).length}**, ${pair.filter(row => row.winner === null).length} empate(s).`);
  }
  lines.push('');
}
lines.push('## Limites', '', 'Cada build disputa 40 lutas; cada confronto tem apenas 10 sementes. Os percentuais descrevem estas builds e estes adversários. Não isolam o valor de um item e não são taxa de vitória de jogadores ou da jornada. A viabilidade de espaço e custo foi validada; encontrar as ofertas e sobreviver até completar as fusões não foi simulado. Nenhum atributo do jogo foi alterado.', '', '`node scripts/simulate-stages.mjs`', '');
writeFileSync('reports/stages-300.md', lines.join('\n'));
console.log(JSON.stringify({ totalFights: report.totalFights, summaries }, null, 2));
