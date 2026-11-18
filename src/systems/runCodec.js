import ShoppingSession from './ShoppingSession.js';
import PackingBoard from './PackingBoard.js';
import { allItems } from '../data/shopCatalog.js';
import { characters } from '../data/characters.js';
import { rotateFootprint } from '../utils/rotation.js';

const FORMAT = 1;
const RULES = '0.7.0';
const MAX_SIZE = 2_000_000;
const counters = ['round', 'gold', 'wins', 'losses', 'draws', 'lives', 'endlessBattles', 'opponentSeed'];
const integer = value => Number.isSafeInteger(value) && value >= 0;
function check(condition) {
  if (!condition) throw new Error('Save inválido ou incompatível.');
}

function packBoard(board) {
  if (!board) return null;
  const pieces = list => list.map(piece => Object.fromEntries(
    ['id', 'catalogId', 'x', 'y', 'rotation', 'oathBattles', 'fusionTargetId', 'startingEquipment']
      .filter(key => piece[key] !== undefined).map(key => [key, piece[key]])));
  return { bags: pieces(board.bags), items: pieces(board.items) };
}

function unpackBoard(data, classId) {
  check(data && Array.isArray(data.bags) && Array.isArray(data.items));
  const ids = new Set();
  const pieces = (list, kind) => list.map(piece => {
    check(piece && typeof piece.id === 'string' && piece.id.length <= 100 && !ids.has(piece.id));
    ids.add(piece.id);
    const entry = allItems.find(item => item.id === piece.catalogId);
    check(entry && entry.kind === kind && (entry.pool === 'general' || entry.pool === classId));
    const rotation = piece.rotation ?? 0;
    check([0, 90, 180, 270].includes(rotation));
    check((piece.x === null && piece.y === null) || (integer(piece.x) && integer(piece.y)));
    check(piece.oathBattles === undefined || (integer(piece.oathBattles) && piece.oathBattles <= 2));
    check(piece.fusionTargetId === undefined || typeof piece.fusionTargetId === 'string');
    check(piece.startingEquipment === undefined || typeof piece.startingEquipment === 'boolean');
    return { ...rotateFootprint(entry, rotation / 90), id: piece.id, catalogId: entry.id,
      x: piece.x, y: piece.y,
      ...(piece.oathBattles === undefined ? {} : { oathBattles: piece.oathBattles }),
      ...(piece.fusionTargetId === undefined ? {} : { fusionTargetId: piece.fusionTargetId }),
      ...(piece.startingEquipment === undefined ? {} : { startingEquipment: piece.startingEquipment }) };
  });
  const board = new PackingBoard({ columns: 8, rows: 8, classId,
    bags: pieces(data.bags, 'bag'), items: pieces(data.items, 'item') });
  // Validate using the real placement rules, adding bags before equipment.
  const validation = new PackingBoard({ columns: 8, rows: 8, classId, bags: [], items: [] });
  for (const kind of ['bag', 'item']) {
    for (const piece of board.getPieces(kind)) {
      validation.getPieces(kind).push({ ...piece, x: null, y: null });
      if (piece.x !== null) {
        if (kind === 'bag') check(validation.getDisplacedBags(piece).length === 0);
        check(validation.move(kind, piece.id, piece.x, piece.y) === null);
      }
    }
  }
  return board;
}

export function encodeRun(session, phase = 'shop', ownerId) {
  check(session.pendingFusions === null && ['shop', 'victory'].includes(phase));
  const raw = JSON.stringify({ format: FORMAT, rules: RULES, savedAt: Date.now(), phase,
    ...(ownerId === undefined ? {} : { ownerId }),
    state: { ...Object.fromEntries(counters.map(key => [key, session[key]])),
      classId: session.classId, endless: session.endless, runResult: session.runResult,
      purchaseCounts: [...session.purchaseCounts], offers: session.offers,
      board: packBoard(session.board), winningBoard: packBoard(session.winningBoard) } });
  check(raw.length <= MAX_SIZE);
  return raw;
}

export function decodeRun(raw) {
  check(typeof raw === 'string' && raw.length <= MAX_SIZE);
  const data = JSON.parse(raw);
  check(data?.format === FORMAT && data.rules === RULES && Number.isFinite(data.savedAt));
  check(!Object.hasOwn(data, 'ownerId') || data.ownerId === null
    || (typeof data.ownerId === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(data.ownerId)));
  check(['shop', 'victory'].includes(data.phase));
  const state = data.state;
  check(state && characters.some(character => character.id === state.classId));
  check(counters.every(key => integer(state[key])) && state.round >= 1 && state.lives > 0 && state.lives <= 5);
  check(state.opponentSeed < 32 && typeof state.endless === 'boolean');
  check(data.phase === 'victory'
    ? state.runResult === 'victory' && state.wins === 10 && !state.endless
    : state.runResult === null && (state.endless ? state.wins >= 10 : state.wins < 10));
  const session = new ShoppingSession({ classId: state.classId, opponentSeed: state.opponentSeed });
  check(Array.isArray(state.offers) && state.offers.length === 6);
  check(state.offers.every(offer => offer && session.catalog.some(item => item.id === offer.id)
    && typeof offer.sold === 'boolean' && typeof offer.locked === 'boolean'));
  check(Array.isArray(state.purchaseCounts) && state.purchaseCounts.length <= allItems.length);
  check(state.purchaseCounts.every(pair => Array.isArray(pair) && pair.length === 2
    && allItems.some(item => item.id === pair[0]) && integer(pair[1])));
  check(new Set(state.purchaseCounts.map(pair => pair[0])).size === state.purchaseCounts.length);
  for (const key of [...counters, 'endless', 'runResult']) session[key] = state[key];
  session.offers = state.offers.map(({ id, sold, locked }) => ({ id, sold, locked }));
  session.purchaseCounts = new Map(state.purchaseCounts);
  session.board = unpackBoard(state.board, state.classId);
  for (const piece of [...session.board.bags, ...session.board.items]) {
    const [base, suffix] = piece.id.split('#');
    const count = suffix === undefined ? 1 : Number(suffix);
    check(piece.id.split('#').length <= 2 && integer(count) && count > 0
      && (session.purchaseCounts.get(base) ?? 0) >= count);
  }
  session.winningBoard = state.winningBoard ? unpackBoard(state.winningBoard, state.classId) : null;
  check(data.phase !== 'victory' || session.winningBoard);
  return { session, phase: data.phase, savedAt: data.savedAt,
    ...(Object.hasOwn(data, 'ownerId') ? { ownerId: data.ownerId } : {}) };
}

