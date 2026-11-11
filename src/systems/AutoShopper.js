import PackingBoard from './PackingBoard.js';
import { getCombatItem } from '../data/combatItems.js';
import { getStarTargets } from '../utils/itemStars.js';
import { rotateFootprint, getFootprintCells } from '../utils/rotation.js';
import { roundIncome } from '../data/economy.js';

const support = item => {
  const stats = getCombatItem(item);
  return stats.triggerArmorChance || stats.weaponDamageBonus || stats.weaponDamagePerBurn || stats.weaponCooldownMultiplier
    || (stats.fusionCatalyst && !stats.damage);
};
const count = (board, predicate) => board.items.filter(predicate).length;
const weapons = board => count(board, item => getCombatItem(item).damage);
const area = pieces => pieces.reduce((sum, item) => sum + getFootprintCells(item).length, 0);

// Only reorganize owned pieces; no combat search or opponent inspection.
export function arrangeItems(source, { stars = true, requireStars = false, repack = true, optimize = false } = {}) {
  const board = new PackingBoard(source);
  if (repack) board.items.forEach(item => { item.x = null; item.y = null; });
  const ordered = board.items.filter(item => item.x === null).sort((a, b) => {
    const priority = item => support(item) ? (optimize ? 50 : -1) : getCombatItem(item).damage ? 100 : item.width * item.height;
    return priority(b) - priority(a);
  });
  for (const item of ordered) {
    let best;
    for (const turns of item.cells ? [0, 1, 2, 3] : [0, 1]) {
      for (let y = 0; y < board.rows; y++) {
        for (let x = 0; x < board.columns; x++) {
          if (board.getPlacementError('item', item.id, x, y, turns)) continue;
          const candidate = { ...rotateFootprint(item, turns), x, y };
          const synergy = stars && support(item) ? getStarTargets(candidate, board.items).reduce((sum, target) => {
            const stats = getCombatItem(target);
            return sum + (item.catalogId === 'fire-stone' ? (target.catalogId === 'quick-daggers' ? 5 : 0)
              : stats.damage ? 5 : item.catalogId === 'refined-iron' && stats.blockChance ? 1 : 0);
          }, 0) : 0;
          // Leave a column between weapons so a support can reach both stars.
          const spacing = optimize && getCombatItem(item).damage ? (x % 2) * 4 : 0;
          const score = synergy * 1000 - y * 8 - x - spacing;
          if (!best || score > best.score) best = { x, y, turns, score, synergy };
          if ((!support(item) && !optimize) || !stars) break;
        }
        if (best && ((!support(item) && !optimize) || !stars)) break;
      }
      if (best && ((!support(item) && !optimize) || !stars)) break;
    }
    if (!best || (requireStars && support(item) && !best.synergy)
      || board.move('item', item.id, best.x, best.y, best.turns)) return null;
  }
  return board;
}

function addBag(board, piece) {
  board.bags.push(piece);
  for (const turns of [0, 1]) for (let y = 0; y < board.rows; y++) for (let x = 0; x < board.columns; x++) {
    const candidate = { ...rotateFootprint(piece, turns), x, y };
    if (board.getDisplacedBags(candidate).length || board.getPlacementError('bag', piece.id, x, y, turns)) continue;
    if (!board.move('bag', piece.id, x, y, turns)) return board;
  }
  return null;
}

function desire(item, session, { skill, profile, rival }) {
  const { board, round } = session;
  const stats = getCombatItem(item);
  const n = count(board, p => p.catalogId === item.id);
  const weaponCount = weapons(board);
  if (item.kind === 'bag') {
    if (!board.bags.length) return item.id === 'traveler-bag' ? 200 : 0;
    if (area(board.bags) - area(board.items) < 7) return 12 * (item.width * item.height / item.price) / 4;
    if (item.id === 'long-bag' && weaponCount >= 2 && board.bags.filter(p => p.catalogId === 'long-bag').length < 2) return 1;
    return 0;
  }
  if (stats.damage) {
    if (!weaponCount) return 100;
    const limit = rival ? (round < 3 ? 1 : 2) : skill === 'beginner' ? 3 : 2;
    if (weaponCount >= limit) return 0;
    return skill === 'beginner' ? 10 : profile === 'offensive' ? 9 : 7;
  }
  if (stats.triggerArmorChance) {
    if (!weaponCount || (rival && round < 3)) return 0;
    if (skill === 'beginner') return n < 1 ? 1 : 0;
    const baseSwords = count(board, p => p.catalogId === 'sword');
    if (baseSwords > n) return skill === 'expert' ? 14 : rival ? 9 : 5;
    return n < (rival ? 2 : skill === 'intermediate' ? 1 : 3) ? (skill === 'expert' ? 8 : 4) / (n + 1) : 0;
  }
  if (item.id === 'fire-stone') return count(board, p => p.catalogId === 'quick-daggers') > n ? 8 : 0;
  if (stats.blockChance) {
    if (rival && n >= (round < 5 ? 2 : 4)) return 0;
    return (profile === 'defensive' ? 10 : skill === 'expert' ? 9 : 6) / (1 + n * 0.65);
  }
  if (stats.healing) {
    if (rival && count(board, p => getCombatItem(p).healing) >= (round < 5 ? 2 : 4)) return 0;
    const value = skill === 'expert' ? 11 : rival ? 8 : 5;
    return value * (stats.regeneration ? 0.8 : 1) / (1 + n * 0.65);
  }
  if (stats.restoreArmor) return (skill === 'beginner' ? 5 : 2) / (1 + n);
  if (stats.restoreStamina) return weaponCount >= 2 ? (skill === 'beginner' ? 5 : 2) / (1 + n) : 0;
  if (stats.weaponDamageBonus) return weaponCount ? (skill === 'expert' ? 4 : skill === 'intermediate' && !rival ? 6 : 2) / (1 + n) : 0;
  if (stats.weaponCooldownMultiplier) return weaponCount ? (skill === 'intermediate' && !rival ? 4 : weaponCount === 1 ? 3 : 0.5) / (1 + n) : 0;
  if (stats.weaponDamagePerBurn) return count(board, piece => getCombatItem(piece).burnChance
    || getCombatItem(piece).weaponBurnChance) ? 4 / (1 + n) : 0;
  if (stats.resistanceInterval || stats.criticalDamageMultiplier || stats.fatigueDamageMultiplier) {
    return weaponCount ? (profile === 'defensive' ? 3 : 1.5) / (1 + n) : 0;
  }
  if (stats.health) return (skill === 'beginner' ? 5 : skill === 'intermediate' && !rival ? 4 : 2) / (1 + n);
  return 0;
}

export function shopAutomatically(session, settings = {}) {
  const options = { skill: 'expert', profile: 'balanced', rival: false, ...settings };
  const { skill, rival } = options;
  const stars = skill !== 'beginner';
  // A learner organizes once per shop; an expert also repacks for each purchase.
  if (!rival && skill === 'intermediate') session.board = arrangeItems(session.board) ?? session.board;
  const actions = [];
  const initialGold = session.gold;
  // Rivals save some income and make bounded decisions instead of exhausting the shop.
  const allowance = rival ? (session.round === 1 ? 13 : roundIncome(session.round)) : initialGold;
  const maxRerolls = skill === 'expert' && !rival ? 5 : 1;
  let rerolls = 0;
  for (let step = 0; step < 50; step++) {
    const available = Math.min(session.gold, allowance - (initialGold - session.gold));
    const choices = session.offers.flatMap((offer, slot) => {
      const item = session.catalog.find(entry => entry.id === offer.id);
      if (!item || offer.sold || item.price > available) return [];
      const score = desire(item, session, options);
      return score > 0 ? [{ item, slot, score }] : [];
    }).sort((a, b) => b.score - a.score || a.slot - b.slot);
    let bought = false;
    for (const { item, slot } of choices) {
      const serial = (session.purchaseCounts.get(item.id) ?? 0) + 1;
      const id = serial === 1 ? item.id : `${item.id}#${serial}`;
      const piece = { ...item, catalogId: item.id, id, x: null, y: null };
      let board = new PackingBoard(session.board);
      if (item.kind === 'bag') board = addBag(board, piece);
      else {
        board.items.push(piece);
        board = arrangeItems(board, { stars, requireStars: rival, repack: rival || skill !== 'intermediate', optimize: skill === 'expert' });
        if (board && stars && support(piece) && !getStarTargets(board.items.find(p => p.id === id), board.items)
          .some(p => item.id === 'fire-stone' ? p.catalogId === 'quick-daggers'
            : getCombatItem(p).damage || (item.id === 'refined-iron' && getCombatItem(p).blockChance))) board = null;
      }
      if (!board) continue;
      const error = session.buy(item.id, slot);
      if (error) throw new Error(error);
      session.board = board;
      actions.push({ buy: item.id, slot, price: item.price, gold: session.gold });
      bought = true;
      break;
    }
    if (bought) continue;
    if (available < 4 || rerolls >= maxRerolls) break;
    const error = session.reroll();
    if (error) throw new Error(error);
    rerolls++;
    actions.push({ reroll: true, gold: session.gold });
  }
  return actions;
}
