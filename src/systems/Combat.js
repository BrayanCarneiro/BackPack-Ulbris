import { combatRules, getCombatItem } from '../data/combatItems.js';
import { getStarTargets } from '../utils/itemStars.js';

const STEP_MS = 100;
const EPSILON = 1e-8;
const round = value => Math.round(value * 1e6) / 1e6;

function createFighter(board) {
  const pieces = [...board.bags, ...board.items].filter(piece => piece.x !== null);
  const maxStamina = combatRules.stamina + pieces.reduce((sum, piece) => sum + (getCombatItem(piece).stamina ?? 0), 0);
  const maxHealth = round(combatRules.health + pieces.reduce((sum, piece) => sum + (getCombatItem(piece).health ?? 0), 0));
  const supports = pieces.filter(piece => getCombatItem(piece).weaponDamageBonus || getCombatItem(piece).weaponCooldownMultiplier)
    .map(piece => ({ ...getCombatItem(piece), targets: getStarTargets(piece, board.items).map(item => item.id) }));
  return {
    health: maxHealth,
    maxHealth,
    stamina: maxStamina,
    maxStamina,
    armor: round(combatRules.armor + pieces.reduce((sum, piece) => sum + (getCombatItem(piece).armor ?? 0), 0)),
    weapons: pieces.filter(piece => getCombatItem(piece).damage).map(piece => {
      const stats = getCombatItem(piece);
      const adjacent = supports.filter(support => support.targets.includes(piece.id));
      const damage = round(stats.damage + Math.min(0.9, adjacent.reduce((sum, support) => sum + (support.weaponDamageBonus ?? 0), 0)));
      const cooldown = round(stats.cooldown * Math.max(0.7, adjacent.reduce((product, support) => product * (support.weaponCooldownMultiplier ?? 1), 1)));
      return { id: piece.id, ...stats, damage, cooldown, readyAt: cooldown };
    }),
    shields: pieces.filter(piece => getCombatItem(piece).blockChance).map(piece => ({ id: piece.id, ...getCombatItem(piece) })),
    potions: pieces.filter(piece => {
      const stats = getCombatItem(piece);
      return stats.healing || stats.restoreStamina || stats.restoreArmor;
    }).map(piece => ({ id: piece.id, ...getCombatItem(piece), consumed: false })),
    regenerations: [],
    irons: pieces.filter(piece => getCombatItem(piece).triggerArmorChance).map(piece => ({
      id: piece.id, ...getCombatItem(piece), targets: getStarTargets(piece, board.items).map(item => item.id),
    })),
  };
}

export default class Combat {
  constructor(playerBoard, enemyBoard, { random = Math.random } = {}) {
    this.fighters = { player: createFighter(playerBoard), enemy: createFighter(enemyBoard) };
    this.random = random;
    this.elapsedMs = 0;
    this.accumulator = 0;
    this.result = null;
  }

  advance(deltaMs) {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Tempo de combate inválido.');
    const events = [];
    if (this.result) return events;
    this.accumulator += deltaMs;
    while (this.accumulator >= STEP_MS && !this.result) {
      this.accumulator -= STEP_MS;
      this.elapsedMs += STEP_MS;
      events.push(...this.step());
    }
    return events;
  }

  step() {
    const time = this.elapsedMs / 1000;
    const attacks = [];
    // Collect both sides' attacks before applying damage: neither side gets priority.
    for (const [side, fighter] of Object.entries(this.fighters)) {
      fighter.stamina = Math.min(fighter.maxStamina,
        round(fighter.stamina + combatRules.staminaPerSecond * STEP_MS / 1000));
      for (const weapon of fighter.weapons) {
        if (time + EPSILON < weapon.readyAt || fighter.stamina + EPSILON < weapon.staminaCost) continue;
        fighter.stamina = Math.max(0, round(fighter.stamina - weapon.staminaCost));
        weapon.readyAt = round(time + weapon.cooldown);
        const attack = this.rollAttack(side, weapon);
        attacks.push(attack);
        if (attack.hit && this.random() < weapon.extraAttackChance) {
          // Extras are immediate and free. Only weapons with a follow-up can reach hit three.
          const extra = this.rollAttack(side, weapon, 2);
          attacks.push(extra);
          if (extra.hit && weapon.followUpAttackChance && this.random() < weapon.followUpAttackChance) {
            attacks.push(this.rollAttack(side, weapon, 3));
          }
        }
      }
    }
    const events = [];
    for (const attack of attacks) events.push(...this.activateStars(attack.side, attack.itemId));
    for (const attack of attacks) {
      const blockEvents = [];
      const outcome = this.applyAttack(attack, blockEvents);
      events.push(...blockEvents, outcome);
    }
    // Once per second after the limit, both fighters lose increasing health.
    // Fatigue bypasses armor and shields, so defensive builds cannot stall forever.
    if (this.elapsedMs > combatRules.fatigueStartsAt * 1000 && this.elapsedMs % 1000 === 0) {
      const damage = round((time - combatRules.fatigueStartsAt) * combatRules.fatigueDamageStep);
      for (const [side, fighter] of Object.entries(this.fighters)) {
        const healthDamage = Math.min(fighter.health, damage);
        fighter.health = round(fighter.health - healthDamage);
        events.push({ type: 'fatigue', side, damage, healthDamage });
      }
    }
    for (const [side, fighter] of Object.entries(this.fighters)) {
      for (const regeneration of fighter.regenerations) {
        if (fighter.health <= 0 || regeneration.remaining <= 0 || time + EPSILON < regeneration.nextAt) continue;
        const healing = round(Math.min(regeneration.amount, fighter.maxHealth - fighter.health));
        fighter.health = round(fighter.health + healing);
        regeneration.remaining -= 1;
        regeneration.nextAt = round(regeneration.nextAt + 1);
        if (healing > 0) events.push({ type: 'heal', side, itemId: regeneration.itemId, healing, regeneration: true });
      }
      for (const potion of fighter.potions) {
        const triggered = potion.healing ? fighter.health <= fighter.maxHealth * potion.healthThreshold
          : potion.restoreStamina ? fighter.stamina <= fighter.maxStamina * potion.staminaThreshold
            : fighter.armor <= potion.armorThreshold;
        if (!potion.consumed && fighter.health > 0 && triggered) {
          potion.consumed = true;
          if (potion.healing) {
            const healing = Math.min(potion.healing, fighter.maxHealth - fighter.health);
            fighter.health = round(fighter.health + healing);
            events.push({ type: 'heal', side, itemId: potion.id, healing });
          }
          if (potion.regeneration) fighter.regenerations.push({ itemId: potion.id, amount: potion.regeneration,
            remaining: potion.regenerationTicks, nextAt: round(time + 1) });
          if (potion.restoreStamina) {
            const amount = round(Math.min(potion.restoreStamina, fighter.maxStamina - fighter.stamina));
            fighter.stamina = round(fighter.stamina + amount);
            events.push({ type: 'stamina', side, itemId: potion.id, amount });
          }
          if (potion.restoreArmor) {
            fighter.armor = round(fighter.armor + potion.restoreArmor);
            events.push({ type: 'armor', side, itemId: potion.id, amount: potion.restoreArmor });
          }
          events.push(...this.activateStars(side, potion.id));
        }
      }
    }
    const playerDead = this.fighters.player.health <= 0;
    const enemyDead = this.fighters.enemy.health <= 0;
    if (playerDead || enemyDead) {
      this.result = playerDead && enemyDead ? 'draw' : playerDead ? 'defeat' : 'victory';
      events.push({ type: 'result', result: this.result });
    }
    return events;
  }

  rollAttack(side, weapon, attackNumber = 1) {
    const hit = this.random() < weapon.accuracy;
    const criticalChance = attackNumber === 3
      ? weapon.thirdAttackCriticalChance ?? weapon.criticalChance : weapon.criticalChance;
    const critical = hit && this.random() < criticalChance;
    return { type: 'attack', side, target: side === 'player' ? 'enemy' : 'player',
      itemId: weapon.id, hit, critical, extra: attackNumber > 1, attackNumber,
      damage: hit ? round(weapon.damage * (critical ? weapon.criticalMultiplier : 1)) : 0 };
  }

  activateStars(side, itemId) {
    const fighter = this.fighters[side];
    const events = [];
    for (const iron of fighter.irons) {
      if (iron.targets.includes(itemId) && this.random() < iron.triggerArmorChance) {
        fighter.armor = round(fighter.armor + iron.triggerArmor);
        events.push({ type: 'armor', side, itemId: iron.id, sourceItemId: itemId, amount: iron.triggerArmor });
      }
    }
    return events;
  }

  applyAttack(attack, blockEvents = []) {
    const target = this.fighters[attack.target];
    let blocked = 0;
    if (attack.hit) {
      for (const shield of target.shields) {
        if (this.random() < shield.blockChance) {
          blocked += shield.blockDamage;
          if (this.random() < shield.extraBlockChance) blocked += shield.extraBlockDamage;
          blockEvents.push(...this.activateStars(attack.target, shield.id));
        }
      }
    }
    blocked = Math.min(attack.damage, blocked);
    const remaining = round(attack.damage - blocked);
    const armorDamage = Math.min(target.armor, remaining);
    const healthDamage = Math.min(target.health, round(remaining - armorDamage));
    target.armor = round(target.armor - armorDamage);
    target.health = round(target.health - healthDamage);
    return { ...attack, blocked, armorDamage, healthDamage };
  }
}
