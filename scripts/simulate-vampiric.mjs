import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import Combat from '../src/systems/Combat.js';
import PackingBoard from '../src/systems/PackingBoard.js';
import { allItems } from '../src/data/shopCatalog.js';
import { combatItems, combatRules, getCombatItem } from '../src/data/combatItems.js';
import { getStarTargets } from '../src/utils/itemStars.js';
import { rotateFootprint, getFootprintCells } from '../src/utils/rotation.js';
import { seededRandom } from '../src/utils/seededRandom.js';

const catalog = new Map(allItems.map(item => [item.id, item]));
const budget = 70;
const roundsPerOpponent = 100;
const layoutsToTry = 12000;
const focusDefinition = { id: 'vampiric', name: 'Vampírico equilibrado', ids: [
  'vampiric-chestplate', 'iron-helmet', 'iron-shield', 'flaming-daggers', 'iron-sword',
  'haste-stone', 'whetstone', 'regeneration-potion', 'vigor-potion', 'vital-crystal',
], fixedLayout: {
  'vampiric-chestplate': [4, 0], 'iron-helmet': [2, 3], 'iron-shield': [0, 2],
  'flaming-daggers': [1, 0], 'iron-sword': [3, 0], 'haste-stone': [2, 0],
  whetstone: [2, 1], 'regeneration-potion': [7, 1], 'vigor-potion': [0, 0], 'vital-crystal': [0, 1],
} };
const enemyDefinitions = [
  { id: 'flames', name: 'Queimadura e armadura', ids: [
    'flaming-daggers', 'flaming-daggers', 'iron-armor', 'iron-helmet', 'iron-shield',
    'haste-stone', 'whetstone', 'regeneration-potion', 'vigor-potion',
    'vital-crystal', 'vital-crystal', 'refined-iron',
  ] },
  { id: 'fortress', name: 'Fortaleza de ferro', ids: [
    'iron-armor', 'iron-helmet', 'iron-shield', 'iron-shield', 'iron-sword', 'iron-sword',
    'haste-stone', 'regeneration-potion', 'protection-potion', 'vigor-potion', 'vital-crystal',
  ] },
  { id: 'axes', name: 'Machados, fogo e estamina', ids: [
    'battle-axe', 'battle-axe', 'iron-helmet', 'iron-shield', 'haste-stone',
    'whetstone', 'whetstone', 'regeneration-potion', 'vigor-potion', 'vigor-potion',
    'energy-crystal', 'energy-crystal', 'protection-potion', 'vital-crystal', 'fire-stone',
  ] },
  { id: 'swords', name: 'Três espadas de ferro', ids: [
    'iron-sword', 'iron-sword', 'iron-sword', 'iron-helmet', 'iron-shield', 'haste-stone',
    'whetstone', 'whetstone', 'regeneration-potion', 'vigor-potion', 'vigor-potion',
    'protection-potion', 'vital-crystal', 'fire-stone',
  ] },
];

// Try only legal packings. Selection uses geometry and active stars, never fight outcomes.
function placements(id) {
  const options = [];
  const seen = new Set();
  for (let turns = 0; turns < 4; turns++) {
    const shape = rotateFootprint(catalog.get(id), turns);
    for (let y = 0; y + shape.height <= 4; y++) {
      for (let x = 0; x + shape.width <= 8; x++) {
        let mask = 0;
        for (const cell of getFootprintCells(shape)) mask |= 1 << ((y + cell.y) * 8 + x + cell.x);
        const key = `${mask}:${shape.rotation}`;
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({ shape, x, y, mask });
      }
    }
  }
  return options;
}
const placementCache = new Map();
function synergy(board) {
  let score = 0;
  for (const piece of board.items) {
    const stats = getCombatItem(piece);
    const targets = getStarTargets(piece, board.items);
    for (const target of targets) {
      const targetStats = getCombatItem(target);
      if (targetStats.damage) {
        if (stats.weaponCooldownMultiplier) score += 10;
        if (stats.weaponDamageBonus) score += 8;
        if (stats.weaponBurnChance) score += 5;
        if (stats.triggerArmorChance) score += 6;
      }
      if (stats.starArmorAmount && targetStats.isArmor) score += 10;
      if (stats.triggerArmorChance && targetStats.blockChance) score += 4;
      if (stats.triggerArmorChance && targetStats.starArmorInterval) score += 3;
    }
  }
  return score;
}
function build(definition, seed) {
  const random = seededRandom(seed);
  const pieces = definition.ids.map((id, index) => {
    assert.ok(catalog.has(id), id);
    if (!placementCache.has(id)) placementCache.set(id, placements(id));
    return { id: `${id}#${index}`, catalogId: id, area: getFootprintCells(catalog.get(id)).length };
  });
  let best;
  let successfulLayouts = 0;
  for (let attempt = 0; attempt < layoutsToTry; attempt++) {
    const ordered = pieces.map(piece => ({ ...piece, priority: piece.area + random() * 3 }))
      .sort((a, b) => b.priority - a.priority);
    let occupied = 0;
    const items = [];
    for (const piece of ordered) {
      const candidates = placementCache.get(piece.catalogId).filter(option => !(occupied & option.mask));
      if (!candidates.length) break;
      const option = candidates[Math.floor(random() * candidates.length)];
      occupied |= option.mask;
      items.push({ ...option.shape, id: piece.id, catalogId: piece.catalogId, x: option.x, y: option.y });
    }
    if (items.length !== pieces.length) continue;
    successfulLayouts++;
    const board = { columns: 8, rows: 8, bags: [0, 4].map((x, i) => ({
      ...catalog.get('traveler-bag'), id: `bag#${i}`, catalogId: 'traveler-bag', x, y: 0,
    })), items };
    const score = synergy(board);
    if (!best || score > best.score) best = { board, score };
  }
  assert.ok(best, `Could not pack ${definition.name}`);
  if (definition.fixedLayout) {
    best.board.items = definition.ids.map((id, index) => ({ ...catalog.get(id), id: `${id}#${index}`,
      catalogId: id, x: definition.fixedLayout[id][0], y: definition.fixedLayout[id][1], rotation: 0 }));
    best.score = synergy(best.board);
  }
  // Use a stable inventory order, independent of layout search order.
  best.board.items.sort((a, b) => definition.ids.indexOf(a.catalogId) - definition.ids.indexOf(b.catalogId)
    || a.id.localeCompare(b.id));
  const validation = new PackingBoard(best.board);
  for (const piece of validation.items) assert.equal(validation.getPlacementError('item', piece.id, piece.x, piece.y), null, piece.id);
  const spent = [...best.board.bags, ...best.board.items].reduce((sum, piece) => sum + piece.price, 0);
  assert.equal(spent, budget, `${definition.name}: budget`);
  const initial = new Combat(best.board, { bags: [], items: [] }).fighters.player;
  const supports = best.board.items.filter(piece => {
    const stats = getCombatItem(piece);
    return stats.weaponDamageBonus || stats.weaponCooldownMultiplier || stats.weaponBurnChance
      || stats.triggerArmorChance || stats.starArmorInterval;
  }).map(piece => ({ id: piece.id, name: piece.name, targets: getStarTargets(piece, best.board.items)
    .map(target => ({ id: target.id, name: target.name })) }));
  console.log(JSON.stringify({ build: definition.name, cost: spent, score: best.score, successfulLayouts,
    life: initial.maxHealth, armor: initial.armor, resistance: initial.resistance }));
  return { ...definition, ...best, spent, successfulLayouts, supports, initial };
}

const focus = build(focusDefinition, 841219);
const opponents = enemyDefinitions.map((definition, i) => build(definition, 929813 + i * 104729));
const battles = [];
for (let enemyIndex = 0; enemyIndex < opponents.length; enemyIndex++) {
  const opponent = opponents[enemyIndex];
  for (let index = 0; index < roundsPerOpponent; index++) {
    // Independent seeds; swapping sides is balanced, without duplicating the same seed.
    const seed = 1000731010 + enemyIndex * 10000019 + index * 7919;
    const reverse = index % 2 === 1;
    const side = reverse ? 'enemy' : 'player';
    const enemySide = reverse ? 'player' : 'enemy';
    const combat = new Combat(reverse ? opponent.board : focus.board,
      reverse ? focus.board : opponent.board, { random: seededRandom(seed) });
    const events = combat.advance(180000);
    assert.ok(combat.result, `Unfinished: ${opponent.id} / ${seed}`);
    const result = combat.result === 'draw' ? 'draw'
      : combat.result === (reverse ? 'defeat' : 'victory') ? 'victory' : 'defeat';
    const total = predicate => events.filter(predicate).reduce((sum, event) => sum + (event.healing ?? 0), 0);
    const damage = events.filter(event => event.type === 'attack' ? event.target === side
      : ['burn', 'fatigue'].includes(event.type) && event.side === side)
      .reduce((sum, event) => sum + event.healthDamage, 0);
    battles.push({ opponent: opponent.id, seed, side, result, seconds: combat.elapsedMs / 1000,
      focusHealth: combat.fighters[side].health, enemyHealth: combat.fighters[enemySide].health,
      vampiricHealing: total(event => event.type === 'heal' && event.side === side && event.damageHealing),
      totalHealing: total(event => event.type === 'heal' && event.side === side),
      healthDamageReceived: damage,
      vampiricActivations: events.filter(event => event.damageHealing && event.side === side).length,
      resistedDebuffs: events.filter(event => event.type === 'debuff-resisted' && event.side === side).length,
      focusBurnDamage: events.filter(event => event.type === 'burn' && event.side === enemySide)
        .reduce((sum, event) => sum + event.healthDamage, 0),
      enemyArmorGenerated: events.filter(event => event.type === 'armor' && event.side === enemySide)
        .reduce((sum, event) => sum + event.amount, 0),
    });
  }
}
const rounded = n => Math.round(n * 1000) / 1000;
function summary(rows) {
  const wins = rows.filter(row => row.result === 'victory').length;
  const defeats = rows.filter(row => row.result === 'defeat').length;
  const draws = rows.length - wins - defeats;
  const average = key => rounded(rows.reduce((sum, row) => sum + row[key], 0) / rows.length);
  const rate = wins / rows.length;
  const z = 1.96, denominator = 1 + z * z / rows.length;
  const center = (rate + z * z / (2 * rows.length)) / denominator;
  const margin = z * Math.sqrt(rate * (1 - rate) / rows.length + z * z / (4 * rows.length ** 2)) / denominator;
  return { fights: rows.length, wins, defeats, draws, winRate: rounded(100 * rate),
    wilson95: [rounded(100 * (center - margin)), rounded(100 * (center + margin))],
    averageSeconds: average('seconds'), averageVampiricHealing: average('vampiricHealing'),
    averageTotalHealing: average('totalHealing'), averageHealthDamageReceived: average('healthDamageReceived'),
    averageVampiricActivations: average('vampiricActivations'), averageResistedDebuffs: average('resistedDebuffs'),
    averageBurnDamageDealt: average('focusBurnDamage'), averageEnemyArmorGenerated: average('enemyArmorGenerated'),
    fatigueFights: rows.filter(row => row.seconds > combatRules.fatigueStartsAt).length,
  };
}
const overall = summary(battles);
const matchups = opponents.map(opponent => ({ id: opponent.id, name: opponent.name,
  ...summary(battles.filter(row => row.opponent === opponent.id)) }));
const bySide = ['player', 'enemy'].map(side => ({ side, ...summary(battles.filter(row => row.side === side)) }));
assert.equal(battles.length, 400);
const baseline = JSON.parse(readFileSync('reports/vampiric-400-3pct.json', 'utf8'));
assert.deepEqual(focus.board, baseline.focus.board, 'Focus layout must match the baseline');
assert.deepEqual(opponents.map(opponent => opponent.board), baseline.opponents.map(opponent => opponent.board),
  'Opponent layouts must match the baseline');
assert.deepEqual(battles.map(({ seed, side, opponent }) => ({ seed, side, opponent })),
  baseline.battles.map(({ seed, side, opponent }) => ({ seed, side, opponent })), 'Paired combat seeds');
const comparableItems = structuredClone(combatItems);
comparableItems['vampiric-chestplate'].damageHealingRatio = baseline.parameters.combatItems['vampiric-chestplate'].damageHealingRatio;
assert.deepEqual(comparableItems, baseline.parameters.combatItems, 'Only Vampiric healing may change');
assert.deepEqual(combatRules, baseline.parameters.combatRules);
const comparison = { baselineFile: 'reports/vampiric-400-3pct.json',
  beforeRatio: baseline.parameters.combatItems['vampiric-chestplate'].damageHealingRatio,
  afterRatio: combatItems['vampiric-chestplate'].damageHealingRatio, before: baseline.overall, after: overall,
  winRateChangePoints: rounded(overall.winRate - baseline.overall.winRate),
  changedResults: battles.filter((battle, i) => battle.result !== baseline.battles[i].result).length,
  transitions: battles.reduce((counts, battle, i) => {
    const key = `${baseline.battles[i].result} -> ${battle.result}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {}),
};
const resultPrefix = `reports/vampiric-400-${Math.round(comparison.afterRatio * 100)}pct`;
const report = { generatedAt: new Date().toISOString(), budget, layoutsToTry, roundsPerOpponent,
  method: '400 fixed-loadout battles paired with the 3% baseline: identical boards, seeds, side and inventory order. Only Vampiric damage-healing ratio changed. 4 opponents × 100, 50 on each side per opponent; same 70-gold equipment budget. Assertions verify identical layouts and all other combat parameters. This is a matchup benchmark, not campaign win rate or proof of the globally optimal build.',
  parameters: { combatRules, combatItems }, focus, opponents, overall, matchups, bySide, battles, comparison };
mkdirSync('reports', { recursive: true });
writeFileSync(`${resultPrefix}.json`, JSON.stringify(report, null, 2) + '\n');
const pct = n => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const num = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const lines = [
  `# Peitoral Vampírico — cura de ${pct(comparison.afterRatio * 100)}, 400 lutas`, '',
  `Resultado: **${overall.wins} vitórias, ${overall.defeats} derrotas e ${overall.draws} empates**; win rate de **${pct(overall.winRate)}**.`, '',
  '## Método', '',
  'Quatro adversários, 100 sementes por adversário; 50 lutas em cada lado. Mesmas builds, posições, sementes e ordem de itens do lote de 3%. A única alteração de atributos é a cura Vampírica; isso foi verificado por assertions. Todos os conjuntos custam 70 de ouro, incluindo duas Mochilas viajantes, e cabem legalmente numa área de 8×4. Não simula encontrar ofertas, comprar ou sobreviver até completar as fusões.', '',
  `${layoutsToTry.toLocaleString('pt-BR')} tentativas de organização por conjunto para procurar estrelas ativas. Os adversários mantêm a melhor organização encontrada por esse critério; o arranjo final da build principal foi montado manualmente para ativar ambas as armas com as duas pedras. A build e os adversários foram fixados antes do lote final.`, '',
  '## Comparação com 3%', '',
  '| Medida | Antes: 3% | Agora |', '|---|---:|---:|',
  `| Vitórias | ${baseline.overall.wins} | ${overall.wins} |`,
  `| Derrotas | ${baseline.overall.defeats} | ${overall.defeats} |`,
  `| Empates | ${baseline.overall.draws} | ${overall.draws} |`,
  `| Win rate | ${pct(baseline.overall.winRate)} | ${pct(overall.winRate)} |`,
  `| Cura Vampírica média | ${num(baseline.overall.averageVampiricHealing)} | ${num(overall.averageVampiricHealing)} |`,
  `Diferença: ${num(comparison.winRateChangePoints)} pontos percentuais. ${comparison.changedResults} resultados individuais mudaram. Os dois lotes não são somados para calcular a taxa.`, '',
  '## Build Vampírica', '',
  `Vida: ${focus.initial.maxHealth}; armadura: ${focus.initial.armor}; resistência: ${focus.initial.resistance}; estamina: ${focus.initial.maxStamina}.`, '',
  '| Item | Ouro | Posição (coluna, linha) | Orientação |', '|---|---:|---|---:|',
  ...focus.board.items.map(piece => `| ${piece.name} | ${piece.price} | (${piece.x + 1}, ${piece.y + 1}) | ${piece.rotation ?? 0}° |`),
  '| 2 Mochilas viajantes | 8 | Colunas 1–4 e 5–8, linhas 1–4 | 0° |', '',
  '### Estrelas da build', '',
  ...focus.supports.map(support => `- ${support.name}: ${support.targets.map(target => target.name).join(', ') || 'nenhum alvo'}.`), '',
  '## Resultados por adversário', '',
  '| Adversário | V | D | E | Win rate | Duração média | Cura Vampírica média |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ...matchups.map(row => `| ${row.name} | ${row.wins} | ${row.defeats} | ${row.draws} | ${pct(row.winRate)} | ${num(row.averageSeconds)} s | ${num(row.averageVampiricHealing)} |`), '',
  `Duração média geral: ${num(overall.averageSeconds)} s. Cura média do Peitoral Vampírico: ${num(overall.averageVampiricHealing)} de vida; cura total média: ${num(overall.averageTotalHealing)}. ${overall.fatigueFights}/400 lutas chegaram à fadiga.`, '',
  '## Leitura dos resultados', '',
  `A cura média passou de ${num(baseline.overall.averageVampiricHealing)} para ${num(overall.averageVampiricHealing)} de vida por luta. O efeito da alteração nos confrontos pode ser visto na tabela; ela não demonstra equilíbrio contra todas as composições.`, '',
  '## Adversários', '',
  ...opponents.flatMap(opponent => [
    `### ${opponent.name}`, '',
    `Vida ${opponent.initial.maxHealth}; armadura ${opponent.initial.armor}; resistência ${opponent.initial.resistance}; estamina ${opponent.initial.maxStamina}.`, '',
    ...Object.entries(opponent.ids.reduce((counts, id) => ({ ...counts, [id]: (counts[id] ?? 0) + 1 }), {}))
      .map(([id, count]) => `- ${count}× ${catalog.get(id).name}`), '',
    ...opponent.supports.map(support => `- Estrelas de ${support.name}: ${support.targets.map(target => target.name).join(', ') || 'nenhum alvo'}.`), '',
  ]),
  '## Limites e reprodução', '',
  'A taxa vale para estes quatro adversários com pesos iguais. Não é taxa de vitória de jogadores ou da jornada, nem comprova que esta é a melhor build. Os lotes de 3% e do valor atual são pareados e não são amostras independentes entre si. Os intervalos individuais no JSON não são um teste da diferença entre taxas.', '',
  '`node scripts/simulate-vampiric.mjs`', '',
  `Coordenadas, rotações, atributos, sementes e resultados individuais: \`${resultPrefix}.json\`.`, '',
];
writeFileSync(`${resultPrefix}.md`, lines.join('\n'));
console.log(JSON.stringify({ overall, matchups, comparison }, null, 2));
