// Eight sequential poses per attack: guard, anticipation, windup, strike,
// contact, follow-through, recovery and guard. Feet share the same baseline.
export const arthurAttacks = {
  quick: { key: 'arthur-attack-quick', file: 'attack-quick.png', frameRate: 32, bodyHeight: 262 },
  normal: { key: 'arthur-attack-normal', file: 'attack-normal.png', frameRate: 24, bodyHeight: 292 },
  critical: { key: 'arthur-attack-critical', file: 'attack-critical.png', frameRate: 20, bodyHeight: 275 },
};

export const attackFrame = { frameWidth: 384, frameHeight: 512, endFrame: 7 };

// Combat weapons already include the cooldown reduction from equipped supports.
export function arthurAttackDuration(weapons, critical = false) {
  const cooldowns = weapons.map(weapon => weapon.cooldown).filter(value => Number.isFinite(value) && value > 0);
  const fastest = cooldowns.length ? Math.min(...cooldowns) : 2.5;
  const duration = Math.max(180, Math.min(720, fastest * 220));
  return duration * (critical ? 1.15 : 1);
}
