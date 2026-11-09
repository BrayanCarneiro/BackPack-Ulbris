import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import BattleBackpack from '../components/BattleBackpack.js';
import BattleCharacter from '../components/BattleCharacter.js';
import { createOpponent } from '../data/opponents.js';
import { runProgress, runRules } from '../data/runRules.js';
import { combatRules } from '../data/combatItems.js';
import { theme } from '../config/theme.js';
import Combat from '../systems/Combat.js';
import { openItemInfo } from '../utils/openItemInfo.js';

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  create({ session }) {
    this.session = session;
    if (session.runResult) {
      this.scene.start('RunEndScene', { session });
      return;
    }
    session.beginBattle();
    this.opponent = createOpponent(session.round, session.opponentSeed);
    this.combat = new Combat(session.board, this.opponent.board);
    this.battleSpeed = 1;
    this.returnScheduled = false;
    this.lastMessage = 'As armas estão preparando o primeiro ataque.';
    this.relayout();
    this.scale.on('resize', this.relayout, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.relayout, this);
      this.scale.setGameSize(720, 1280);
    });
  }

  relayout() {
    if (this.layingOut) return;
    this.layingOut = true;
    try {
      const { width, height } = this.scale.parentSize;
      const wide = width >= 900 && width / height >= 1.1;
      const logicalWidth = wide ? Math.round(1280 * width / height) : 720;
      if (this.scale.width !== logicalWidth) this.scale.setGameSize(logicalWidth, 1280);
      this.children.removeAll(true);
      this.drawArena(logicalWidth, wide);
    } finally {
      this.layingOut = false;
    }
  }

  drawArena(width, wide) {
    const { session } = this;
    const center = width / 2;
    const panelWidth = wide ? Math.min(480, (width - 512) / 2) : 188;
    const panelLeft = wide ? (width - panelWidth * 2 - 448) / 2 : 24;
    const backpackLayout = { ...(wide ? { width: panelWidth, top: 350, gridSize: Math.min(360, panelWidth - 40) } : {}),
      onInspect: item => openItemInfo(this, item) };
    const characterOffset = wide ? 106 : 71;
    const textStyle = { fontFamily: theme.fontFamily, color: theme.text, align: 'center' };
    this.add.text(center, 65, runProgress(session), {
      ...textStyle, fontSize: '18px', color: theme.muted, letterSpacing: 3,
    }).setOrigin(0.5);
    this.add.text(center, 124, 'Fase de batalha', {
      ...textStyle, fontSize: '44px', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.resultText = this.add.text(center, 192, 'Dois aventureiros. Um encontro.', {
      ...textStyle, fontSize: '24px', color: theme.muted,
    }).setOrigin(0.5);

    const decoration = this.add.graphics();
    decoration.lineStyle(1, theme.accent, 0.3);
    decoration.lineBetween(center - 312, 290, center - 90, 290);
    decoration.lineBetween(center + 90, 290, center + 312, 290);
    this.add.text(center, 290, `RODADA ${session.round} · ${this.opponent.name.toUpperCase()}`, {
      ...textStyle, fontSize: '18px', color: theme.muted,
    }).setOrigin(0.5);
    this.add.rectangle(center, 636, wide ? 360 : 272, 450, theme.surface, 0.35);
    this.timeText = this.add.text(center, 362, '', {
      ...textStyle, fontSize: '18px', color: theme.muted, letterSpacing: 2,
    }).setOrigin(0.5);

    this.backpacks = {
      player: new BattleBackpack(this, panelLeft, session.board, 'SUA MOCHILA', backpackLayout),
      enemy: new BattleBackpack(this, width - panelLeft - panelWidth, this.opponent.board, 'MOCHILA INIMIGA', backpackLayout),
    };
    this.characters = {
      player: new BattleCharacter(this, center - characterOffset, { player: true, fighter: this.combat.fighters.player }),
      enemy: new BattleCharacter(this, center + characterOffset, { player: false, fighter: this.combat.fighters.enemy }),
    };
    this.add.text(center, 800, 'VS', {
      ...textStyle, fontSize: '28px', fontStyle: 'bold', color: theme.muted,
    }).setOrigin(0.5);
    this.speedButton = new TextButton(this, center, 890, `${this.battleSpeed}x`, () => {
      this.battleSpeed = this.battleSpeed % 3 + 1;
      this.speedButton.setLabel(`${this.battleSpeed}x`);
      this.tweens.timeScale = this.battleSpeed;
    }, { width: 88, height: 44, fontSize: 22 });
    this.tweens.timeScale = this.battleSpeed;
    this.messageText = this.add.text(center, 965, this.lastMessage, {
      ...textStyle, fontSize: '20px', color: theme.muted,
      wordWrap: { width: wide ? 360 : 620 }, lineSpacing: 8,
    }).setOrigin(0.5);
    this.fatigueText = this.add.text(center, 1040, '', {
      ...textStyle, fontSize: '18px', color: theme.muted,
    }).setOrigin(0.5);
    this.returnButton = new TextButton(this, center, 1110, 'Voltar às compras', () => {
      this.returnToShop();
    }, { height: 76 });
    new TextButton(this, center, 1210, 'Voltar ao menu', () => this.scene.start('MenuScene'),
      { height: 54, fontSize: 22 });
    this.refreshCombat();
  }

  update(time, delta) {
    if (!this.combat) return;
    const events = this.combat.advance(delta * this.battleSpeed);
    const messages = [];
    const number = value => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    for (const event of events) {
      if (event.type === 'attack') {
        this.backpacks[event.side].activate(event.itemId, { extra: event.extra });
        this.characters[event.side].attack(event);
        this.characters[event.target].defend(event);
        const name = event.side === 'player' ? 'Você' : 'Inimigo';
        const outcome = !event.hit ? 'errou' : event.blocked === event.damage ? 'golpe bloqueado'
          : `${number(event.armorDamage)} na armadura, ${number(event.healthDamage)} na vida`;
        const tags = [event.extra ? `${event.attackNumber}º golpe` : '', event.critical ? 'crítico' : ''].filter(Boolean);
        messages.push(`${name}${tags.length ? ` (${tags.join(', ')})` : ''}: ${outcome}.`);
      } else if (event.type === 'heal') {
        this.backpacks[event.side].activate(event.itemId);
        messages.push(`${event.side === 'player' ? 'Você' : 'Inimigo'}: ${event.regeneration ? 'regeneração' : 'poção'} curou ${number(event.healing)} de vida.`);
      } else if (event.type === 'armor') {
        this.backpacks[event.side].activate(event.itemId);
        messages.push(`${event.side === 'player' ? 'Você' : 'Inimigo'}: +${number(event.amount)} de armadura.`);
      } else if (event.type === 'stamina') {
        this.backpacks[event.side].activate(event.itemId);
        messages.push(`${event.side === 'player' ? 'Você' : 'Inimigo'}: poção recuperou ${number(event.amount)} de estamina.`);
      } else if (event.type === 'fatigue') {
        messages.push(`${event.side === 'player' ? 'Você' : 'Inimigo'}: fadiga causou ${number(event.healthDamage)} de dano.`);
      }
    }
    if (messages.length) this.lastMessage = messages.slice(-3).join('\n');
    this.refreshCombat();
    if (this.combat.result && !this.returnScheduled) {
      this.returnScheduled = true;
      this.time.delayedCall(1600, () => this.returnToShop());
    }
  }

  returnToShop() {
    if (!this.combat.result) return;
    const report = this.session.finishBattle(this.combat.result);
    if (!report) return;
    this.scene.start(this.session.runResult ? 'RunEndScene' : 'ShopScene', { session: this.session, report });
  }

  refreshCombat() {
    const { fighters, result, elapsedMs } = this.combat;
    if (result) this.returnButton.setInteractive({ useHandCursor: true }).setAlpha(1);
    else this.returnButton.disableInteractive().setAlpha(0.4);
    const finalBattle = this.session.wins + (result === 'victory' ? 1 : 0) >= runRules.targetWins
      || (result && result !== 'victory' && this.session.lives === 1);
    this.returnButton.setLabel(finalBattle ? 'Ver resultado da jornada' : 'Voltar às compras');
    const seconds = Math.floor(elapsedMs / 1000);
    this.fatigueText.setText(seconds >= combatRules.fatigueStartsAt
      ? 'Fadiga: dano crescente direto à vida a cada segundo.'
      : `Fadiga em ${combatRules.fatigueStartsAt - seconds}s: atingirá os dois lados.`);
    this.timeText.setText(`${result ? 'ENCERRADO' : 'EM COMBATE'} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
    this.resultText.setText(result ? { victory: 'Vitória!', defeat: 'Derrota', draw: 'Empate' }[result]
      : 'Dois aventureiros. Um encontro.');
    for (const side of ['player', 'enemy']) {
      this.characters[side].refresh(fighters[side], elapsedMs / 1000, result);
      this.backpacks[side].refresh(fighters[side],
        (elapsedMs + (result ? 0 : this.combat.accumulator)) / 1000);
    }
    this.messageText.setText(this.lastMessage);
  }
}
