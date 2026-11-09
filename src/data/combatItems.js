// Seconds for cooldowns; stamina and damage may contain fractional values.
export const combatRules = {
  health: 30,
  stamina: 4.4,
  staminaPerSecond: 1,
  armor: 0,
  fatigueStartsAt: 60,
  fatigueDamageStep: 0.6,
  statusTurnSeconds: 1,
  weaponDamageBonusLimit: 0.9,
  weaponCooldownMinimum: 0.7,
};

export const combatItems = {
  'traveler-bag': {},
  'long-bag': { stamina: 1 },
  pouch: { armor: 1.2 },
  sword: {
    damage: 1.8, accuracy: 0.88, staminaCost: 1.2, cooldown: 2,
    criticalChance: 0.03, criticalMultiplier: 1.5, extraAttackChance: 0.1,
  },
  'quick-daggers': {
    damage: 1, accuracy: 0.95, staminaCost: 0.4, cooldown: 1.3,
    criticalChance: 0.08, criticalMultiplier: 1.5,
  },
  hatchet: {
    damage: 3, accuracy: 0.8, staminaCost: 1.5, cooldown: 3,
    criticalChance: 0.04, criticalMultiplier: 1.4,
  },
  bow: {
    damage: 3.4, accuracy: 0.85, staminaCost: 1.4, cooldown: 2.8,
    criticalChance: 0.1, criticalMultiplier: 1.75,
  },
  'battle-axe': {
    damage: 5.5, accuracy: 0.75, staminaCost: 2.5, cooldown: 3.2,
    criticalChance: 0.05, criticalMultiplier: 1.5, stunChance: 0.15, stunSeconds: 1,
  },
  'flaming-daggers': {
    damage: 1.4, accuracy: 0.95, staminaCost: 0.8, cooldown: 1.3,
    criticalChance: 0.08, criticalMultiplier: 1.5,
    burnChance: 0.2, burnDamage: 2, burnTurns: 2, burnRequiresUnblockedHit: true,
  },
  'fire-stone': { fusionCatalyst: true },
  'iron-sword': {
    damage: 3, accuracy: 0.9, staminaCost: 1.5, cooldown: 2.5,
    criticalChance: 0.03, criticalMultiplier: 1.5,
    extraAttackChance: 0.1, followUpAttackChance: 0.2,
    thirdAttackCriticalChance: 0.6,
  },
  shield: { armor: 9, blockChance: 0.3, blockDamage: 1.8, extraBlockChance: 0.1, extraBlockDamage: 1.8 },
  potion: { healing: 12, healthThreshold: 0.45 },
  'refined-iron': { triggerArmorChance: 0.3, triggerArmor: 2.4 },
  'iron-shield': { armor: 9, blockChance: 0.45, blockDamage: 1.8, extraBlockChance: 0, extraBlockDamage: 0 },
  'vigor-potion': { restoreStamina: 2.4, staminaThreshold: 0.25 },
  'protection-potion': { restoreArmor: 6, armorThreshold: 0 },
  'regeneration-potion': { healing: 6, healthThreshold: 0.6, regeneration: 1.2, regenerationTicks: 6 },
  whetstone: { weaponDamageBonus: 0.3 },
  'haste-stone': { weaponCooldownMultiplier: 0.9 },
  'vital-crystal': { health: 4 },
};

export function getCombatItem(piece) {
  return combatItems[piece.catalogId ?? piece.id] ?? {};
}
