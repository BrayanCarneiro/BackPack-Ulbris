export const oathRules = { sword: 'knight-greatsword', requiredBattles: 2 };

export function oathProgress(piece) {
  return Math.min(oathRules.requiredBattles, Math.max(0, Math.floor(piece?.oathBattles ?? 0)));
}
