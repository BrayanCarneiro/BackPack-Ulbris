import { occupiesCell, getFootprintCells } from './rotation.js';
import { getCombatItem } from '../data/combatItems.js';

export const catalogId = piece => piece.catalogId ?? piece.id;

export function hasItemStars(piece) {
  const stats = getCombatItem(piece);
  return Boolean(stats.triggerArmorChance || stats.weaponDamageBonus || stats.weaponDamagePerBurn
    || stats.weaponCooldownMultiplier || stats.fusionCatalyst || stats.starArmorInterval || stats.weaponLifeStealChance);
}

// Match the target types that can actually activate each support's combat effect.
export function getActiveStarCells(piece, items) {
  if (piece.x === null || piece.y === null || !hasItemStars(piece)) return [];
  const stats = getCombatItem(piece);
  return getStarCells(piece).filter(cell => items.some(target => {
    if (target.id === piece.id || !occupiesCell(target, cell.x, cell.y)) return false;
    const effect = getCombatItem(target);
    if (stats.starArmorInterval) return Boolean(effect.isArmor);
    if (stats.triggerArmorChance) return Boolean(effect.damage || effect.blockChance || effect.healing
      || effect.restoreStamina || effect.restoreArmor || effect.starArmorInterval);
    return Boolean(effect.damage);
  }));
}

export function getStarCells(piece) {
  if (getCombatItem(piece).singleRightStar) {
    const turn = ((piece.rotation ?? 0) % 360 + 360) % 360 / 90;
    return [[{ x: piece.x + piece.width, y: piece.y }],
      [{ x: piece.x, y: piece.y + piece.height }],
      [{ x: piece.x - 1, y: piece.y }],
      [{ x: piece.x, y: piece.y - 1 }]][turn];
  }
  const rotation = ((piece.rotation ?? 0) % 180 + 180) % 180;
  if (rotation === 90) {
    return [{ x: piece.x, y: piece.y - 1 }, { x: piece.x, y: piece.y + piece.height }];
  }
  return [{ x: piece.x - 1, y: piece.y }, { x: piece.x + piece.width, y: piece.y }];
}
export function getStarTargets(piece, items) {
  if (piece.x === null) return [];
  const stars = getStarCells(piece);
  return items.filter(item => item.id !== piece.id && item.x !== null
    && stars.some(cell => occupiesCell(item, cell.x, cell.y)));
}

export function getAdjacentTargets(piece, items) {
  if (piece.x === null || piece.y === null) return [];
  const cells = getFootprintCells(piece);
  return items.filter(item => item.id !== piece.id && item.x !== null && item.y !== null
    && cells.some(cell => {
      const x = piece.x + cell.x, y = piece.y + cell.y;
      return occupiesCell(item, x - 1, y) || occupiesCell(item, x + 1, y)
        || occupiesCell(item, x, y - 1) || occupiesCell(item, x, y + 1);
    }));
}
