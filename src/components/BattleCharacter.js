import { theme } from '../config/theme.js';
import { formatNumber as number, formatCompactNumber } from '../utils/formatNumber.js';
import { arthurAttacks, arthurAttackDuration } from '../data/arthurAnimations.js';

export default class BattleCharacter {
  constructor(scene, x, { player, fighter, wide = false }) {
    Object.assign(this, { scene, x, player, wide, attacking: false, shaking: false, ended: false });
    this.nextAttack = 0;
    this.attackPlaybackRate = 1;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const color = player ? theme.valid : theme.invalid;
    const barWidth = wide ? 228 : 142;
    this.barWidth = barWidth - 8;
    const text = (y, label, size, color = theme.text) => scene.add.text(x, y, label, {
      fontFamily: theme.fontFamily, fontSize: `${size}px`, color, align: 'center',
    }).setOrigin(0.5);
    text(400, player ? 'VOCÊ · ARTHUR' : 'INIMIGO · ARTHUR', wide ? 23 : 17);
    scene.add.rectangle(x, 441, barWidth, 26, 0x101e24).setStrokeStyle(1, 0xf2ce54, 0.7);
    scene.add.rectangle(x, 482, barWidth, 29, 0x101e24).setStrokeStyle(1, color, 0.8);
    this.staminaBar = scene.add.rectangle(x - this.barWidth / 2, 441, this.barWidth, 18, 0xf2ce54).setOrigin(0, 0.5);
    this.healthBar = scene.add.rectangle(x - this.barWidth / 2, 482, this.barWidth, 21, color).setOrigin(0, 0.5);
    this.staminaText = text(441, '', wide ? 19 : 16, '#ffffff').setStroke('#101e24', 3);
    this.healthText = text(482, '', wide ? 21 : 18, '#ffffff').setStroke('#101e24', 3);
    this.armorText = text(518, '', wide ? 20 : 16, theme.muted);
    this.statusText = text(wide ? 552 : 559, '', wide ? 17 : 14, '#ff9c80');
    this.feedback = text(866, '', wide ? 21 : 16);
    this.cooldownText = text(wide ? 895 : 922, '', wide ? 18 : 15, theme.muted);

    const bodyHeight = wide ? 278 : 208;
    const bodyWidth = bodyHeight * 663 / 983;
    this.bodyHeight = bodyHeight;
    scene.add.ellipse(x, 833, bodyWidth + 22, 23, 0x080f13, 0.7);
    this.art = scene.add.container(x, 832);
    this.motion = scene.add.container(0, 0);
    this.impact = scene.add.container(0, 0);
    this.rig = scene.add.container(0, 0).setScale(player ? 1 : -1, 1);
    this.art.add(this.motion);
    this.motion.add(this.impact);
    this.impact.add(this.rig);
    this.aura = scene.add.container(0, 0).setVisible(false);
    // Soft red silhouettes work in Canvas and WebGL without expensive post effects.
    for (const [dx, dy, alpha] of [[-5, 0, 0.045], [5, 0, 0.045], [0, -5, 0.045], [0, 5, 0.045], [0, 0, 0.08]]) {
      this.aura.add(scene.add.image(dx, dy, 'arthur-battle-body-burn')
        .setOrigin(0.5, 1).setDisplaySize(bodyWidth + 5, bodyHeight + 5).setAlpha(alpha));
    }
    this.body = scene.add.image(0, 0, 'arthur-battle-body', 'rig').setOrigin(0.5, 1).setDisplaySize(bodyWidth, bodyHeight);
    this.burnTint = scene.add.image(0, 0, 'arthur-battle-body-burn')
      .setOrigin(0.5, 1).setDisplaySize(bodyWidth, bodyHeight).setAlpha(0.09).setVisible(false);
    this.hand = { x: bodyWidth * 0.44, y: -bodyHeight * 0.44 };
    this.sword = scene.add.image(this.hand.x, this.hand.y, 'arthur-battle-sword', 'rig')
      .setOrigin(0.5, 0.86).setDisplaySize(bodyHeight * 0.164, bodyHeight * 0.82).setAngle(35);
    // The sword rotates behind the closed fist, keeping the grip held.
    this.rig.add([this.aura, this.sword, this.body, this.burnTint]);
    this.attackSprite = scene.add.sprite(0, 0, arthurAttacks.normal.key, 0)
      .setOrigin(180 / 384, 444 / 512).setVisible(false);
    this.rig.add(this.attackSprite);
    this.attackSprite.on('animationcomplete', () => {
      this.attacking = false;
      this.attackSprite.setVisible(false);
      this.body.setVisible(true);
      this.sword.setVisible(true);
      this.burnTint.setVisible(this.aura.visible);
    });
    if (!this.reducedMotion) scene.tweens.add({
      targets: this.rig, y: -2, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.art.once('destroy', () => scene.tweens.killTweensOf([this.motion, this.impact, this.rig, this.sword]));
    this.refresh(fighter, 0);
  }

  refresh(fighter, time, result) {
    this.fighter = fighter;
    this.staminaText.setText(`EST ${number(fighter.stamina)} / ${number(fighter.maxStamina)}`);
    this.staminaBar.setScale(fighter.maxStamina > 0 ? Math.max(0, Math.min(1, fighter.stamina / fighter.maxStamina)) : 0, 1);
    this.healthText.setText(`${number(fighter.health)} / ${number(fighter.maxHealth)}`);
    this.healthBar.setScale(Math.max(0, Math.min(1, fighter.health / fighter.maxHealth)), 1);
    this.armorText.setText(`Armadura: ${number(fighter.armor)}`);
    this.statusText.setText([
      fighter.maxResistance ? `Resistência: ${fighter.resistance}/${fighter.maxResistance}` : '',
      fighter.burns?.length ? `Queimadura: ${fighter.burns.length}` : '',
      fighter.stunnedUntil > time ? `Atordoado: ${number(fighter.stunnedUntil - time)}s` : '',
    ].filter(Boolean).join('\n'));
    this.aura.setVisible(!result && fighter.health > 0 && Boolean(fighter.burns?.length));
    this.burnTint.setVisible(this.aura.visible && !this.attacking);
    if (this.aura.visible) this.attackSprite.setTint(0xffc6bd);
    else this.attackSprite.clearTint();
    this.aura.setAlpha(this.reducedMotion ? 1 : 0.8 + Math.sin(time * 5) * 0.2);
    const weapon = fighter.weapons[0];
    const remaining = weapon ? Math.max(0, weapon.readyAt - time) : 0;
    this.cooldownText.setText(result ? '' : !weapon ? 'Sem arma' : remaining > 0
      ? `Recarga: ${remaining.toFixed(1).replace('.', ',')}s` : fighter.stamina < weapon.staminaCost ? 'Sem estamina' : 'Pronto');
    if (!this.ended && (fighter.health <= 0 || result)) this.finish(fighter.health <= 0 ? 'dead'
      : (this.player ? result === 'victory' : result === 'defeat') ? 'victory' : 'draw');
  }

  attack(event) {
    if (this.attacking || this.ended) return;
    this.attacking = true;
    this.attackVariant = event.critical ? 'critical' : this.nextAttack === 0 ? 'normal' : 'quick';
    // A critical interrupts the alternation without consuming the next normal move.
    if (!event.critical) this.nextAttack = 1 - this.nextAttack;
    const attack = arthurAttacks[this.attackVariant];
    this.attackDurationMs = arthurAttackDuration(this.fighter.weapons, event.critical);
    this.attackPlaybackRate = (8000 / attack.frameRate) / this.attackDurationMs;
    this.body.setVisible(false);
    this.sword.setVisible(false);
    this.burnTint.setVisible(false);
    this.attackSprite.setVisible(true).setScale(this.bodyHeight / attack.bodyHeight);
    this.attackSprite.play(attack.key);
    this.syncAttackSpeed();
    const duration = this.attackDurationMs / 2;
    if (!this.reducedMotion) this.scene.tweens.add({
      targets: this.motion, x: (this.player ? 1 : -1) * (event.critical ? 13 : 8),
      angle: (this.player ? 1 : -1) * (event.critical ? 2.5 : 1.2),
      duration, yoyo: true, ease: 'Sine.easeOut',
    });
    this.feedback.setText(!event.hit ? 'Errou' : event.critical ? 'Crítico!' : event.extra ? 'Ataque extra!' : 'Ataque');
  }

  syncAttackSpeed() {
    this.attackSprite.anims.timeScale = (this.scene.battleSpeed ?? 1) * this.attackPlaybackRate;
  }

  defend(event) {
    this.feedback.setText(event.blocked > 0 ? `Bloqueou ${formatCompactNumber(event.blocked)}`
      : event.armorDamage > 0 ? `−${formatCompactNumber(event.armorDamage)} armadura`
        : event.healthDamage > 0 ? `−${formatCompactNumber(event.healthDamage)} vida` : this.feedback.text);
    if (this.ended || this.shaking || this.reducedMotion || !(event.armorDamage > 0 || event.healthDamage > 0)) return;
    this.shaking = true;
    // Damage never cancels the independently animated attack.
    this.scene.tweens.add({
      targets: this.impact, x: this.player ? -1.7 : 1.7, duration: 24, yoyo: true, repeat: 1,
      onComplete: () => { this.impact.x = 0; this.shaking = false; },
    });
  }

  finish(outcome) {
    this.ended = outcome;
    this.attackSprite.stop().setVisible(false);
    this.body.setVisible(true);
    this.sword.setVisible(true);
    this.attacking = false;
    this.shaking = false;
    this.scene.tweens.killTweensOf([this.motion, this.impact, this.rig, this.sword]);
    this.motion.setPosition(0, 0).setAngle(0);
    this.impact.setPosition(0, 0);
    this.rig.y = 0;
    this.aura.setVisible(false);
    this.burnTint.setVisible(false);
    if (outcome === 'dead') {
      this.body.setTexture('arthur-battle-body-gray');
      this.sword.setTexture('arthur-battle-sword-gray');
      this.sword.angle = 65;
      this.rig.setAlpha(0.75);
      this.feedback.setText('Derrotado');
    } else if (outcome === 'victory') {
      this.feedback.setText('Vitória!');
      this.scene.tweens.add({ targets: this.sword, angle: -8, duration: this.reducedMotion ? 0 : 380, ease: 'Back.easeOut' });
      if (!this.reducedMotion) this.scene.tweens.add({ targets: this.rig, y: -4, duration: 260, ease: 'Sine.easeOut' });
    } else {
      this.sword.angle = 35;
      this.feedback.setText('Empate');
    }
  }
}
