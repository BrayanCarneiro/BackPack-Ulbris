import ShoppingSession from './ShoppingSession.js';
import Combat from './Combat.js';
import { shopAutomatically } from './AutoShopper.js';
import { seededRandom } from '../utils/seededRandom.js';
import { economy } from '../data/economy.js';

const profiles = ['balanced', 'offensive', 'defensive'];
const names = { balanced: 'Viajante', offensive: 'Duelista', defensive: 'Sentinela' };
const histories = new Map();
export const opponentName = round => names[profiles[(round - 1) % profiles.length]];

// Persistent NPC training histories: no fabricated results or combat-based loadout selection.
export function createOpponent(round, seed = 0) {
  if (!Number.isInteger(round) || round < 1 || round > 11) throw new RangeError('Rodada inválida.');
  if (!Number.isInteger(seed) || seed < 0) throw new RangeError('Semente inválida.');
  const roster = seed % 32;
  const profile = profiles[(round - 1) % profiles.length];
  const key = `${roster}:${profile}`;
  if (!histories.has(key)) histories.set(key, {
    session: new ShoppingSession({ random: seededRandom(83017 + roster * 7919 + profiles.indexOf(profile) * 101), campaign: false, opponentSeed: roster }),
    snapshots: [], history: [], income: economy.startingGold,
  });
  const career = histories.get(key);
  while (career.snapshots.length < round) {
    const { session } = career;
    const actions = shopAutomatically(session, { skill: 'intermediate', profile, rival: true });
    if (session.getCompletionError()) throw new Error('O rival não conseguiu preparar uma mochila válida.');
    const board = { columns: 8, rows: 8, bags: structuredClone(session.board.bags), items: structuredClone(session.board.items) };
    const spent = [...board.bags, ...board.items].reduce((sum, piece) => sum + piece.price, 0);
    career.history.push({ round: session.round, actions, gold: session.gold, board });
    career.snapshots.push({ name: names[profile], profile, tier: Math.min(3, Math.floor((session.round - 1) / 3)),
      budget: career.income, spent, gold: session.gold, shoppingSpent: career.income - session.gold,
      board, history: structuredClone(career.history) });
    session.beginBattle();
    // Complete one real sparring fight before granting the next income or fusion.
    const combat = new Combat(board, board, { random: seededRandom(991 + roster * 103 + session.round) });
    combat.advance(180000);
    if (!combat.result) throw new Error('Treino do rival não terminou.');
    const report = session.finishBattle(combat.result);
    Object.assign(career.history[career.history.length - 1], { result: combat.result, fusions: report.fusionNames });
    career.income += report.income;
  }
  return structuredClone(career.snapshots[round - 1]);
}
