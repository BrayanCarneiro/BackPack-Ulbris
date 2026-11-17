export const runRules = {
  targetWins: 10,
  startingLives: 5,
};

export function runProgress(session) {
  if (session.endless) return `Infinito · Vitórias ${session.wins} · Vidas ${session.lives}/${runRules.startingLives}`;
  return `Vitórias ${session.wins}/${runRules.targetWins} · Vidas ${session.lives}/${runRules.startingLives}`;
}
