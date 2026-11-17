// Internal settings: difficulty is never shown in the player interface.
export const difficultyLevels = [
  { name: 'Muito fácil', skill: 'beginner', resources: 0.65, allowance: 0.65, rerolls: 0, stars: false },
  { name: 'Fácil', skill: 'beginner', resources: 0.85, allowance: 0.85, rerolls: 1, stars: false },
  { name: 'Normal', skill: 'intermediate', resources: 1, allowance: 1, rerolls: 1, stars: true },
  { name: 'Médio', skill: 'intermediate', resources: 1.1, allowance: 1.1, rerolls: 2, stars: true },
  { name: 'Médio difícil', skill: 'expert', resources: 1.25, allowance: 1.25, rerolls: 3, stars: true },
  { name: 'Difícil', skill: 'expert', resources: 1.5, allowance: 1.5, rerolls: 4, stars: true },
  { name: 'Muito difícil', skill: 'expert', resources: 1.8, allowance: 1.8, rerolls: 6, stars: true },
  { name: 'Impossível', skill: 'expert', resources: 2.2, allowance: 2.2, rerolls: 8, stars: true },
  { name: 'DEUS', skill: 'expert', resources: 2.8, allowance: 2.8, rerolls: 12, stars: true },
];

export function difficultyForRun(session) {
  return session.endless ? Math.min(9, 5 + Math.floor(session.endlessBattles / 10)) : 3;
}

export function getDifficulty(level) {
  if (!Number.isInteger(level) || level < 1 || level > 9) throw new RangeError('Dificuldade inválida.');
  return difficultyLevels[level - 1];
}
