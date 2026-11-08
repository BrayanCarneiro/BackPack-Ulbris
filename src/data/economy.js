export const economy = { startingGold: 14, rerollCost: 1, offerCount: 6 };

export const roundIncome = round => 8 + Math.min(5, Math.max(0, round - 2));
export const sellPrice = piece => Math.max(1, Math.floor(piece.price / 2));

export function opponentBudget(round) {
  let gold = economy.startingGold;
  for (let next = 2; next <= round; next++) gold += roundIncome(next) - 1;
  return gold;
}
