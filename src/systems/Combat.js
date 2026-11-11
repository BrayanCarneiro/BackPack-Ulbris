import { combatRules, getCombatItem } from '../data/combatItems.js';
import { getStarTargets } from '../utils/itemStars.js';

const STEP_MS = 100;
const EPSILON = 1e-8;
const round = value => Math.round(value * 1e6) / 1e6;

function createFighter(board) {
  const pieces = [...board.bags, ...board.items].filter(piece => piece.x !== null);
  const maxStamina = combatRules.stamina + pieces.reduce((sum, piece) => sum + (getCombatItem(piece).stamina ?? 0), 0);
  const maxHealth = round(combatRules.health + pieces.reduce((sum, piece) => sum + (getCombatItem(piece).health ?? 0), 0));
  const supports = pieces.filter(piece => getCombatItem(piece).weaponDamageBonus
    || getCombatItem(piece).weaponCooldownMultiplier || getCombatItem(piece).weaponBurnChance
    || getCombatItem(piece).weaponLifeStealChance || getCombatItem(piece).weaponDamagePerBurn)
    .map(piece => ({ ...getCombatItem(piece), targets: getStarTargets(piece, board.items).map(item => item.id) }));
  const resistance = pieces.reduce((sum, piece) => sum + (getCombatItem(piece).resistance ?? 0), 0);
  return {
    health: maxHealth,
    maxHealth,
    stamina: maxStamina,
    maxStamina,
    armor: round(combatRules.armor + pieces.reduce((sum, piece) => sum + (getCombatItem(piece).armor ?? 0), 0)),
    resistance,
    maxResistance: resistance,
    resistanceGenerators: pieces.filter(piece => getCombatItem(piece).resistanceInterval).map(piece => {
      const stats = getCombatItem(piece);
      return { id: piece.id, interval: stats.resistanceInterval, nextAt: stats.resistanceInterval,
        amount: stats.resistanceAmount };
    }),
    fatigueDamageMultiplier: pieces.reduce((value, piece) => value * (getCombatItem(piece).fatigueDamageMultiplier ?? 1), 1),
    lastLights: pieces.filter(piece => getCombatItem(piece).lastLightThreshold).map(piece => ({
      id: piece.id, threshold: getCombatItem(piece).lastLightThreshold,
      ratio: getCombatItem(piece).lastLightHealingRatio, consumed: false,
    })),
    damageHealers: pieces.filter(piece => getCombatItem(piece).damageHealingRatio)
      .map(piece => ({ id: piece.id, ratio: getCombatItem(piece).damageHealingRatio })),
    stunDurationMultiplier: pieces.reduce((value, piece) => value * (getCombatItem(piece).stunDurationMultiplier ?? 1), 1),
    criticalDamageMultiplier: pieces.reduce((value, piece) => value * (getCombatItem(piece).criticalDamageMultiplier ?? 1), 1),
    armorGenerators: pieces.filter(piece => getCombatItem(piece).starArmorInterval).map(piece => {
      const stats = getCombatItem(piece);
      const count = getStarTargets(piece, board.items).filter(target => getCombatItem(target).isArmor).length;
      return { id: piece.id, interval: stats.starArmorInterval, nextAt: stats.starArmorInterval,
        amount: stats.starArmorAmount * count };
    }),
    weapons: pieces.filter(piece => getCombatItem(piece).damage).map(piece => {
      const stats = getCombatItem(piece);
      const adjacent = supports.filter(support => support.targets.includes(piece.id));
      const damage = round(stats.damage + Math.min(combatRules.weaponDamageBonusLimit,
        adjacent.reduce((sum, support) => sum + (support.weaponDamageBonus ?? 0), 0)));
      const cooldown = round(stats.cooldown * Math.max(combatRules.weaponCooldownMinimum,
        adjacent.reduce((product, support) => product * (support.weaponCooldownMultiplier ?? 1), 1)));
      const fireSupports = adjacent.filter(support => support.weaponBurnChance);
      const burn = fireSupports.length ? {
        burnChance: Math.min(1, round((stats.burnChance ?? 0)
          + fireSupports.reduce((sum, support) => sum + support.weaponBurnChance, 0))),
        burnDamage: stats.burnDamage ?? fireSupports[0].weaponBurnDamage,
        burnTurns: stats.burnTurns ?? fireSupports[0].weaponBurnTurns,
        burnRequiresUnblockedHit: stats.burnRequiresUnblockedHit ?? true,
      } : {};
      const lifeStealSupports = adjacent.filter(support => support.weaponLifeStealChance);
      const lifeSteal = lifeStealSupports.length ? {
        lifeStealChance: Math.min(1, round(lifeStealSupports.reduce((sum, support) => sum + support.weaponLifeStealChance, 0))),
        lifeStealRatio: lifeStealSupports[0].weaponLifeStealRatio,
      } : {};
      const damagePerBurn = adjacent.reduce((sum, support) => sum + (support.weaponDamagePerBurn ?? 0), 0);
      return { id: piece.id, ...stats, ...burn, ...lifeSteal, damage, damagePerBurn, cooldown, readyAt: cooldown };
    }),
    shields: pieces.filter(piece => getCombatItem(piece).blockChance).map(piece => ({ id: piece.id, ...getCombatItem(piece) })),
    potions: pieces.filter(piece => {
      const stats = getCombatItem(piece);
      return stats.healing || stats.restoreStamina || stats.restoreArmor;
    }).map(piece => ({ id: piece.id, ...getCombatItem(piece), consumed: false })),
    regenerations: [],
    burns: [],
    stunnedUntil: 0,
    irons: pieces.filter(piece => getCombatItem(piece).triggerArmorChance).map(piece => ({
      id: piece.id, ...getCombatItem(piece), readyAt: 0,
      targets: getStarTargets(piece, board.items).map(item => item.id),
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
    const resistanceEvents = [];
    // Collect both sides' attacks before applying damage: neither side gets priority.
    for (const [side, fighter] of Object.entries(this.fighters)) {
      for (const generator of fighter.resistanceGenerators) {
        if (fighter.health <= 0 || time + EPSILON < generator.nextAt) continue;
        generator.nextAt = round(generator.nextAt + generator.interval);
        fighter.resistance += generator.amount;
        fighter.maxResistance = Math.max(fighter.maxResistance, fighter.resistance);
        // Collected below with combat events, including while stunned.
        resistanceEvents.push({ type: 'resistance', side, itemId: generator.id, amount: generator.amount });
      }
      fighter.stamina = Math.min(fighter.maxStamina,
        round(fighter.stamina + combatRules.staminaPerSecond * STEP_MS / 1000));
      if (time + EPSILON < fighter.stunnedUntil) continue;
      // Oldest ready weapon gets the next stamina, on both sides. Keep the
      // inventory order intact; a cheaper weapon must not bypass a waiting one.
      const queue = [...fighter.weapons].sort((a, b) => a.readyAt - b.readyAt);
      for (const weapon of queue) {
        if (time + EPSILON < weapon.readyAt || fighter.stamina + EPSILON < weapon.staminaCost) break;
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
    const events = [...resistanceEvents];
    const lifeSteals = [];
    for (const attack of attacks) events.push(...this.activateStars(attack.side, attack.itemId));
    for (const attack of attacks) {
      const blockEvents = [];
      const outcome = this.applyAttack(attack, blockEvents, true);
      events.push(...blockEvents, outcome);
      if (attack.hit) {
        events.push(...this.applyWeaponEffects(outcome, time));
        this.healAfterDamage(outcome.target, outcome.healthDamage, events);
        const healing = this.rollLifeSteal(outcome);
        if (healing > 0) lifeSteals.push({ side: attack.side, itemId: attack.itemId, healing });
      }
    }
    // Resolve simultaneous hits before healing so life steal cannot revive a defeated fighter.
    for (const steal of lifeSteals) {
      const fighter = this.fighters[steal.side];
      if (fighter.health <= 0) continue;
      const healing = round(Math.min(steal.healing, fighter.maxHealth - fighter.health));
      if (healing <= 0) continue;
      fighter.health = round(fighter.health + healing);
      events.push({ type: 'heal', ...steal, healing, lifeSteal: true });
    }
    // Every stack owns its two ticks; a new hit never refreshes older burns.
    for (const [side, fighter] of Object.entries(this.fighters)) {
      for (const generator of fighter.armorGenerators) {
        if (time + EPSILON < generator.nextAt || fighter.health <= 0) continue;
        generator.nextAt = round(generator.nextAt + generator.interval);
        if (!generator.amount) continue;
        fighter.armor = round(fighter.armor + generator.amount);
        events.push({ type: 'armor', side, itemId: generator.id, amount: generator.amount });
        events.push(...this.activateStars(side, generator.id));
      }
      for (const burn of fighter.burns) {
        if (!fighter.burns.length) break;
        if (time + EPSILON < burn.nextAt) continue;
        const armorDamage = burn.ignoresArmor ? 0 : round(Math.min(fighter.armor, burn.damage));
        fighter.armor = round(fighter.armor - armorDamage);
        const healthDamage = round(Math.min(fighter.health, burn.damage - armorDamage));
        fighter.health = round(fighter.health - healthDamage);
        burn.remaining -= 1;
        burn.nextAt = round(burn.nextAt + combatRules.statusTurnSeconds);
        events.push({ type: 'burn', side, source: burn.source, itemId: burn.itemId,
          damage: burn.damage, armorDamage, healthDamage });
        this.healAfterDamage(side, healthDamage, events);
      }
      fighter.burns = fighter.burns.filter(burn => burn.remaining > 0);
    }
    // Once per second after the limit, both fighters lose increasing health.
    // Fatigue bypasses armor and shields, so defensive builds cannot stall forever.
    if (this.elapsedMs > combatRules.fatigueStartsAt * 1000 && this.elapsedMs % 1000 === 0) {
      const damage = round((time - combatRules.fatigueStartsAt) * combatRules.fatigueDamageStep);
      for (const [side, fighter] of Object.entries(this.fighters)) {
        const reducedDamage = round(damage * fighter.fatigueDamageMultiplier);
        const healthDamage = Math.min(fighter.health, reducedDamage);
        fighter.health = round(fighter.health - healthDamage);
        events.push({ type: 'fatigue', side, damage: reducedDamage, healthDamage });
        this.healAfterDamage(side, healthDamage, events);
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

  applyWeaponEffects(attack, time) {
    const weapon = this.fighters[attack.side].weapons.find(item => item.id === attack.itemId);
    const target = this.fighters[attack.target];
    const events = [];
    if (weapon.burnChance && (!weapon.burnRequiresUnblockedHit || attack.blocked < attack.damage)
      && this.random() < weapon.burnChance) {
      if (!this.resistDebuff(attack, 'burn', events)) {
        target.burns.push({ source: attack.side, itemId: attack.itemId, damage: weapon.burnDamage,
          ignoresArmor: weapon.burnIgnoresArmor ?? true,
          remaining: weapon.burnTurns, nextAt: round(time + combatRules.statusTurnSeconds) });
        events.push({ type: 'burn-applied', side: attack.target, source: attack.side,
          itemId: attack.itemId, stacks: target.burns.length });
      }
    }
    if (weapon.stunChance && this.random() < weapon.stunChance) {
      if (!this.resistDebuff(attack, 'stun', events)) {
        const seconds = round(weapon.stunSeconds * target.stunDurationMultiplier);
        const until = round(time + seconds);
        const extension = Math.max(0, round(until - Math.max(time, target.stunnedUntil)));
        target.stunnedUntil = Math.max(target.stunnedUntil, until);
        for (const item of target.weapons) item.readyAt = round(Math.max(time, item.readyAt) + extension);
        events.push({ type: 'stun', side: attack.target, source: attack.side,
          itemId: attack.itemId, seconds });
      }
    }
    return events;
  }

  resistDebuff(attack, debuff, events) {
    const target = this.fighters[attack.target];
    if (target.resistance <= 0) return false;
    target.resistance -= 1;
    events.push({ type: 'debuff-resisted', side: attack.target, source: attack.side,
      itemId: attack.itemId, debuff, remaining: target.resistance });
    return true;
  }

  rollLifeSteal(attack) {
    const weapon = this.fighters[attack.side].weapons.find(item => item.id === attack.itemId);
    if (!attack.hit || attack.healthDamage <= 0 || !weapon.lifeStealChance) return 0;
    return this.random() < weapon.lifeStealChance ? round(attack.healthDamage * weapon.lifeStealRatio) : 0;
  }

  healAfterDamage(side, healthDamage, events) {
    const fighter = this.fighters[side];
    if (healthDamage <= 0 || fighter.health <= 0) return;
    for (const light of fighter.lastLights) {
      if (light.consumed || fighter.health > fighter.maxHealth * light.threshold + EPSILON) continue;
      light.consumed = true;
      fighter.burns = [];
      const time = this.elapsedMs / 1000;
      const remainingStun = Math.max(0, fighter.stunnedUntil - time);
      fighter.stunnedUntil = 0;
      if (remainingStun > 0) {
        for (const weapon of fighter.weapons) weapon.readyAt = round(Math.max(time, weapon.readyAt - remainingStun));
      }
      const healing = round(Math.min(fighter.maxHealth * light.ratio, fighter.maxHealth - fighter.health));
      fighter.health = round(fighter.health + healing);
      events.push({ type: 'heal', side, itemId: light.id, healing, lastLight: true });
    }
    for (const healer of fighter.damageHealers) {
      const healing = round(Math.min(healthDamage * healer.ratio, fighter.maxHealth - fighter.health));
      if (healing <= 0) continue;
      fighter.health = round(fighter.health + healing);
      events.push({ type: 'heal', side, itemId: healer.id, healing, damageHealing: true });
    }
  }

  activateStars(side, itemId) {
    const fighter = this.fighters[side];
    const events = [];
    const time = this.elapsedMs / 1000;
    // Limit eligible sources before rolling: failed rolls cannot fall through to extra irons.
    const irons = fighter.irons.filter(iron => iron.targets.includes(itemId)).slice(0, combatRules.ironLimitPerItem);
    for (const iron of irons) {
      if (time + EPSILON >= iron.readyAt && this.random() < iron.triggerArmorChance) {
        fighter.armor = round(fighter.armor + iron.triggerArmor);
        iron.readyAt = round(time + (iron.triggerArmorCooldown ?? 0));
        events.push({ type: 'armor', side, itemId: iron.id, sourceItemId: itemId, amount: iron.triggerArmor });
      }
    }
    return events;
  }

  applyAttack(attack, blockEvents = [], deferHealing = false) {
    const target = this.fighters[attack.target];
    const weapon = this.fighters[attack.side]?.weapons.find(item => item.id === attack.itemId);
    if (attack.hit && weapon?.damagePerBurn) {
      const stacks = target.burns.filter(burn => burn.remaining > 0).length;
      attack = { ...attack, damage: round(attack.damage + weapon.damagePerBurn * stacks
        * (attack.critical ? weapon.criticalMultiplier : 1)) };
    }
    if (attack.hit && attack.critical) {
      attack = { ...attack, damage: round(attack.damage * target.criticalDamageMultiplier) };
    }
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
    if (!deferHealing) this.healAfterDamage(attack.target, healthDamage, blockEvents);
    return { ...attack, blocked, armorDamage, healthDamage };
  }
}
