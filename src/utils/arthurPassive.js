import { getCombatItem } from '../data/combatItems.js';
import { getAdjacentTargets } from './itemStars.js';
import { getFootprintCells, occupiesCell } from './rotation.js';

export const arthurPassive = { bonusPerArmor: 0.05, maxArmor: 3 };

export function getArthurBonus(piece, board) {
  if (board?.classId !== 'arthur' || !getCombatItem(piece).damage || piece.x == null || piece.y == null) return 0;
  const count = getAdjacentTargets(piece, board.items).filter(target => getCombatItem(target).isArmor).length;
  return Math.round(Math.min(count, arthurPassive.maxArmor) * arthurPassive.bonusPerArmor * 100) / 100;
}

// Use the real perimeter, including the inner edges of irregular weapons.
export function getArthurStarCells(piece, classId) {
  if (classId !== 'arthur' || !getCombatItem(piece).damage || piece.x == null || piece.y == null) return [];
  const cells = new Map();
  for (const slot of getFootprintCells(piece)) {
    const x = piece.x + slot.x, y = piece.y + slot.y;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const cell = { x: x + dx, y: y + dy };
      if (!occupiesCell(piece, cell.x, cell.y)) cells.set(`${cell.x}:${cell.y}`, cell);
    }
  }
  return [...cells.values()];
}

export function getActiveArthurStarCells(piece, board) {
  const targets = new Set();
  return getArthurStarCells(piece, board.classId).filter(cell => {
    const target = board.items.find(target => target.id !== piece.id && getCombatItem(target).isArmor
      && occupiesCell(target, cell.x, cell.y));
    if (!target || targets.has(target.id)) return false;
    targets.add(target.id);
    return true;
  });
}
