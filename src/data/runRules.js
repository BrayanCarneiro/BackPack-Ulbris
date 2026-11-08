export const runRules = {
  targetWins: 8,
  startingLives: 4,
};

export function runProgress(session) {
  return `Vitórias ${session.wins}/${runRules.targetWins} · Vidas ${session.lives}/${runRules.startingLives}`;
}
