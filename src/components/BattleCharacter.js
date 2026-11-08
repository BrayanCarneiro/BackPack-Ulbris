import { theme } from '../config/theme.js';

export default class BattleCharacter {
  constructor(scene, x, { player, fighter }) {
    this.scene = scene;
    this.x = x;
    this.player = player;
    const color = player ? theme.valid : theme.invalid;
    scene.add.text(x, 400, player ? 'VOCÊ' : 'INIMIGO', {
      fontFamily: theme.fontFamily, fontSize: '19px', fontStyle: 'bold', color: theme.text,
    }).setOrigin(0.5);
    scene.add.rectangle(x, 479, 112, 18, 0x101e24).setStrokeStyle(1, color, 0.6);
    this.staminaText = scene.add.text(x, 440, '', {
      fontFamily: theme.fontFamily, fontSize: '16px', color: theme.text,
    }).setOrigin(0.5);
    this.healthBar = scene.add.rectangle(x - 53, 479, 106, 12, color).setOrigin(0, 0.5);
    this.healthText = scene.add.text(x, 509, '', {
      fontFamily: theme.fontFamily, fontSize: '20px', fontStyle: 'bold', color: theme.text,
    }).setOrigin(0.5);
    this.armorText = scene.add.text(x, 540, '', {
      fontFamily: theme.fontFamily, fontSize: '16px', color: theme.muted,
    }).setOrigin(0.5);
    this.feedback = scene.add.text(x, 805, '', {
      fontFamily: theme.fontFamily, fontSize: '15px', color: theme.text,
    }).setOrigin(0.5);
    this.cooldownText = scene.add.text(x, 842, '', {
      fontFamily: theme.fontFamily, fontSize: '15px', color: theme.muted,
    }).setOrigin(0.5);

    scene.add.ellipse(x, 762, 106, 26, 0x080f13, 0.7);
    const art = scene.add.graphics();
    // Both adventurers face inward, with matching armor and distinct cloaks.
    art.fillStyle(color, 0.7);
    art.fillTriangle(-26, -55, -47, 62, 20, 62);
    art.fillStyle(0x263b41);
    art.fillRoundedRect(-24, 36, 20, 57, 4);
    art.fillRoundedRect(6, 36, 20, 57, 4);
    art.fillStyle(0x0d181e);
    art.fillRoundedRect(-29, 82, 27, 15, 3);
    art.fillRoundedRect(3, 82, 30, 15, 3);
    art.fillStyle(player ? theme.bag : 0x614c48);
    art.fillRoundedRect(-29, -47, 58, 90, 9);
    art.fillStyle(color);
    art.fillRoundedRect(-34, -48, 25, 20, 5);
    art.fillRoundedRect(15, -48, 25, 20, 5);
    art.fillStyle(theme.accent);
    art.fillRect(-28, 24, 56, 8);
    art.fillRoundedRect(-5, -30, 10, 38, 2);
    art.fillStyle(0xd5bd87);
    art.fillCircle(0, -76, 25);
    art.fillStyle(0x819494);
    art.fillRoundedRect(-27, -103, 54, 28, 8);
    art.fillRect(-27, -82, 13, 29);
    art.fillStyle(0x101e24);
    art.fillRect(5, -80, 17, 5);
    art.fillStyle(0x819494);
    art.fillRoundedRect(27, -26, 15, 47, 4);
    art.fillStyle(0xd5bd87);
    art.fillCircle(36, 21, 9);
    art.fillStyle(0xc4d4d0);
    art.fillTriangle(45, 12, 49, -65, 55, 12);
    art.fillStyle(theme.accent);
    art.fillRect(36, 12, 27, 6);
    art.fillRect(46, 18, 7, 18);
    this.art = art.setPosition(x, 660).setScale(player ? 1 : -1, 1);
    this.refresh(fighter, 0);
  }

  refresh(fighter, time, result) {
    const number = value => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    this.staminaText.setText(`EST ${number(fighter.stamina)} / ${number(fighter.maxStamina)}`);
    this.healthText.setText(`${number(fighter.health)} / ${number(fighter.maxHealth)}`);
    this.healthBar.setScale(fighter.health / fighter.maxHealth, 1);
    this.armorText.setText(`Armadura: ${number(fighter.armor)}`);
    const weapon = fighter.weapons[0];
    let cooldown = 'Sem arma';
    if (weapon) {
      const remaining = Math.max(0, weapon.readyAt - time);
      cooldown = remaining > 0 ? `Recarga: ${remaining.toFixed(1).replace('.', ',')}s`
        : fighter.stamina < weapon.staminaCost ? 'Sem estamina' : 'Pronto';
    }
    this.cooldownText.setText(result ? '' : cooldown);
    this.art.setAlpha(fighter.health > 0 ? 1 : 0.35);
  }

  attack(event) {
    this.scene.tweens.killTweensOf(this.art);
    this.art.x = this.x;
    this.scene.tweens.add({ targets: this.art, x: this.x + (this.player ? 12 : -12), duration: 110, yoyo: true });
    this.feedback.setText(!event.hit ? 'Errou' : event.attackNumber === 3 ? '3º golpe!'
      : event.extra ? 'Ataque extra!' : event.critical ? 'Crítico!' : 'Ataque');
  }

  defend(event) {
    const number = value => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    this.feedback.setText(event.blocked > 0 ? `Bloqueou ${number(event.blocked)}`
      : event.armorDamage > 0 ? `−${number(event.armorDamage)} armadura`
        : event.healthDamage > 0 ? `−${number(event.healthDamage)} vida` : this.feedback.text);
  }
}
