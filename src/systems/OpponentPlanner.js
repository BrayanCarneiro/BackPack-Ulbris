import { allItems } from '../data/shopCatalog.js';
import { opponentBudget } from '../data/economy.js';
import PackingBoard from './PackingBoard.js';
import Combat from './Combat.js';
import { getStarTargets } from '../utils/itemStars.js';
import { getCombatItem } from '../data/combatItems.js';

const catalog = allItems;
const cache = new Map();
const profiles = ['balanced', 'offensive', 'defensive'];
const names = { balanced: 'Viajante', offensive: 'Duelista', defensive: 'Sentinela' };
const isSupport = item => {
  const stats = getCombatItem(item);
  return stats.triggerArmorChance || stats.weaponDamageBonus || stats.weaponCooldownMultiplier;
};
export const opponentName = round => names[profiles[(round - 1) % profiles.length]];
const plans = [
  ['sword', 'shield', 'potion', 'refined-iron', 'sword', 'shield', 'potion', 'refined-iron'],
  ['sword', 'sword', 'potion', 'shield', 'refined-iron', 'shield', 'potion', 'refined-iron'],
  ['sword', 'shield', 'refined-iron', 'potion', 'shield', 'sword', 'refined-iron', 'potion'],
  ['sword', 'potion', 'refined-iron', 'sword', 'shield', 'potion', 'shield', 'refined-iron'],
  ['sword', 'shield', 'shield', 'potion', 'refined-iron', 'sword', 'potion', 'refined-iron'],
  ['sword', 'sword', 'shield', 'refined-iron', 'potion', 'sword', 'potion', 'shield'],
  ['sword', 'iron-shield', 'vigor-potion', 'whetstone', 'sword', 'haste-stone', 'regeneration-potion', 'refined-iron'],
  ['sword', 'shield', 'protection-potion', 'vital-crystal', 'regeneration-potion', 'sword', 'refined-iron', 'vigor-potion'],
  ['sword', 'whetstone', 'haste-stone', 'vigor-potion', 'sword', 'iron-shield', 'vital-crystal', 'refined-iron'],
];

function pack(round, budget, plan, upgraded, staminaBags) {
  const board = new PackingBoard({ columns: 8, rows: 8, bags: [], items: [] });
  let spent = 0, serial = 0;
  const piece = id => ({ ...catalog.find(entry => entry.id === id), catalogId: id,
    id: `enemy-${++serial}`, x: null, y: null, rotation: 0 });
  const addBag = (id, x, y) => {
    const bag = piece(id);
    board.bags.push(bag);
    board.move('bag', bag.id, x, y);
    spent += bag.price;
  };
  addBag('traveler-bag', 0, 0);
  if (budget >= 26) addBag('traveler-bag', 4, 0);
  for (let i = 0; i < staminaBags; i++) addBag('long-bag', 0, 4 + i);
  const selected = [];
  const purchases = [...plan,
    ...(round >= 5 ? ['refined-iron', 'shield', 'potion'] : []),
    ...(round >= 8 ? ['sword', 'refined-iron', 'potion'] : [])];
  for (const id of purchases) {
    const item = piece(id === 'iron-shield' && round === 1 ? 'shield'
      : id === 'sword' && upgraded && round >= 2 ? 'iron-sword' : id);
    if (round === 1 && selected.some(other => other.catalogId === item.catalogId)) continue;
    if (getCombatItem(item).damage && selected.filter(other => getCombatItem(other).damage).length >= 3) continue;
    if (spent + item.price > budget) continue;
    selected.push(item);
    spent += item.price;
  }
  if (!selected.some(item => getCombatItem(item).damage)) return null;
  const area = selected.reduce((sum, item) => sum + item.width * item.height, 0);
  if (board.bags.length === 1 + staminaBags && area > 16 + staminaBags * 5 && spent + 4 <= budget) {
    addBag('traveler-bag', 4, 0);
  }
  selected.sort((a, b) => {
    const priority = item => isSupport(item) ? -1
      : getCombatItem(item).damage ? 10 : item.width * item.height;
    return priority(b) - priority(a);
  });
  for (const item of selected) {
    board.items.push(item);
    let best = null;
    for (const turns of [0, 1]) {
      for (let y = 0; y < board.rows; y++) {
        for (let x = 0; x < board.columns; x++) {
          if (board.getPlacementError('item', item.id, x, y, turns)) continue;
          const candidate = { ...item, x, y, rotation: turns * 90 };
          const targets = isSupport(item) ? getStarTargets(candidate, board.items) : [];
          const iron = item.catalogId === 'refined-iron';
          const synergy = targets.reduce((sum, target) => sum + (getCombatItem(target).damage ? 5
            : iron && getCombatItem(target).blockChance ? 2
              : iron && (getCombatItem(target).healing || getCombatItem(target).restoreStamina || getCombatItem(target).restoreArmor) ? 1 : 0), 0);
          const score = synergy * 100 - y * 8 - x;
          if (!best || score > best.score) best = { x, y, turns, score, synergy };
        }
      }
    }
    if (!best || (isSupport(item) && !best.synergy)) {
      board.items.pop();
      spent -= item.price;
    } else board.move('item', item.id, best.x, best.y, best.turns);
  }
  return { board, spent };
}

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function createOpponent(round) {
  if (!Number.isInteger(round) || round < 1) throw new RangeError('Rodada inválida.');
  if (cache.has(round)) return structuredClone(cache.get(round));
  const budget = opponentBudget(round);
  const profile = profiles[(round - 1) % profiles.length];
  const candidates = [];
  for (const plan of plans) {
    for (const upgraded of [false, true]) {
      for (const staminaBags of round >= 6 ? [0, 1, 2] : [0, 1]) {
        const candidate = pack(round, budget, plan, upgraded, staminaBags);
        if (candidate) candidates.push(candidate);
      }
    }
  }
  const references = [plans[0], plans[1], plans[4]].map(plan =>
    pack(round, budget, plan, round >= 3, round >= 4 ? 1 : 0).board);
  let best = null;
  for (const candidate of candidates) {
    let score = 0;
    for (const reference of references) {
      for (const seed of [17, 83]) {
        const combat = new Combat(candidate.board, reference, { random: seededRandom(seed + round * 101) });
        combat.advance(120000);
        const { player, enemy } = combat.fighters;
        score += combat.result === 'victory' ? 4 : combat.result === 'draw' ? 1 : 0;
        score += (player.health - enemy.health) / 60;
      }
    }
    const count = id => candidate.board.items.filter(item => item.catalogId === id).length;
    const weapons = candidate.board.items.filter(item => getCombatItem(item).damage).length;
    // Style breaks close ties; combat performance remains the main criterion.
    score += profile === 'offensive' ? weapons * 0.08
      : profile === 'defensive' ? count('shield') * 0.08 : count('potion') * 0.08;
    if (!best || score > best.score) best = { ...candidate, score };
  }
  const result = { name: names[profile], profile, tier: Math.min(3, Math.floor((round - 1) / 3)),
    budget, spent: best.spent, board: { columns: 8, rows: 8, bags: best.board.bags, items: best.board.items } };
  cache.set(round, result);
  return structuredClone(result);
}
