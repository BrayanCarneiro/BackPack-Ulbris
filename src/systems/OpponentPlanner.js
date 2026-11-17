import ShoppingSession from './ShoppingSession.js';
import Combat from './Combat.js';
import { shopAutomatically } from './AutoShopper.js';
import { seededRandom } from '../utils/seededRandom.js';
import { economy, roundIncome } from '../data/economy.js';
import { cloneData } from '../utils/cloneData.js';
import { getDifficulty } from '../data/difficulty.js';

const profiles = ['balanced', 'offensive', 'defensive'];
const names = { balanced: 'Viajante', offensive: 'Duelista', defensive: 'Sentinela' };
const histories = new Map();
export const opponentName = round => names[profiles[(round - 1) % profiles.length]];

// Persistent NPC training histories: no fabricated results or combat-based loadout selection.
export function createOpponent(round, seed = 0, { includeHistory = true, difficulty = 3 } = {}) {
  if (!Number.isSafeInteger(round) || round < 1) throw new RangeError('Rodada inválida.');
  if (!Number.isInteger(seed) || seed < 0) throw new RangeError('Semente inválida.');
  const settings = getDifficulty(difficulty);
  // Mature careers are reused so an endless run never builds an unbounded history.
  const trainingRound = Math.min(round, 30);
  const roster = seed % 32;
  const profile = profiles[(round - 1) % profiles.length];
  const key = `${roster}:${profile}:${difficulty}`;
  if (!histories.has(key)) histories.set(key, {
    session: new ShoppingSession({ random: seededRandom(83017 + roster * 7919 + profiles.indexOf(profile) * 101), classId: 'arthur', campaign: false, opponentSeed: roster }),
    snapshots: [], history: [], income: economy.startingGold,
  });
  const career = histories.get(key);
  while (career.snapshots.length < trainingRound) {
    const { session } = career;
    const baseIncome = session.round === 1 ? economy.startingGold : roundIncome(session.round);
    const bonus = Math.round(baseIncome * settings.resources) - baseIncome;
    session.gold += bonus;
    career.income += bonus;
    const actions = shopAutomatically(session, { skill: settings.skill, profile, rival: true,
      allowanceMultiplier: settings.allowance, maxRerolls: settings.rerolls, stars: settings.stars });
    if (session.getCompletionError()) throw new Error('O rival não conseguiu preparar uma mochila válida.');
    const board = { classId: session.classId, columns: 8, rows: 8, bags: cloneData(session.board.bags), items: cloneData(session.board.items) };
    const spent = [...board.bags, ...board.items].reduce((sum, piece) => sum + (piece.startingEquipment ? 0 : piece.price), 0);
    career.history.push({ round: session.round, actions, gold: session.gold, board });
    career.snapshots.push({ name: names[profile], profile, difficulty, tier: Math.min(3, Math.floor((session.round - 1) / 3)),
      budget: career.income, spent, gold: session.gold, shoppingSpent: career.income - session.gold,
      // Boards/actions are immutable snapshots; share them internally instead of copying every previous round.
      board, history: career.history.map(entry => ({ ...entry })) });
    session.beginBattle();
    // Complete one real sparring fight before granting the next income or fusion.
    const combat = new Combat(board, board, { random: seededRandom(991 + roster * 103 + session.round) });
    combat.advance(180000);
    if (!combat.result) throw new Error('Treino do rival não terminou.');
    const report = session.finishBattle(combat.result);
    Object.assign(career.history[career.history.length - 1], { result: combat.result, fusions: report.fusionNames });
    career.income += report.income;
  }
  const snapshot = career.snapshots[trainingRound - 1];
  if (includeHistory) return cloneData(snapshot);
  const { history, ...opponent } = snapshot;
  return cloneData(opponent);
}
