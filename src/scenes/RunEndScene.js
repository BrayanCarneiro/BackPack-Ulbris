import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import { theme } from '../config/theme.js';
import { runProgress, runRules } from '../data/runRules.js';

export default class RunEndScene extends Phaser.Scene {
  constructor() {
    super('RunEndScene');
  }

  create({ session, report }) {
    const won = session.runResult === 'victory';
    const text = (y, label, size, color = theme.text) => this.add.text(360, y, label, {
      fontFamily: theme.fontFamily, fontSize: `${size}px`, color, align: 'center',
      wordWrap: { width: 600 }, lineSpacing: 12,
    }).setOrigin(0.5);
    this.add.rectangle(360, 600, 640, 860, theme.surface).setStrokeStyle(1, theme.accent, 0.5);
    text(240, 'ULBRIS · FIM DA JORNADA', 20, theme.muted);
    text(340, won ? 'Jornada conquistada!' : 'A jornada terminou', 38);
    text(450, won ? `Você alcançou ${runRules.targetWins} vitórias!`
      : 'Suas vidas se esgotaram.\nUma nova mochila, uma nova estratégia.', 25, theme.muted);
    text(575, runProgress(session), 26);
    text(690, `${session.wins + session.losses + session.draws} batalhas concluídas\n`
      + `${session.wins} vitórias · ${session.losses} derrotas · ${session.draws} empates`, 23, theme.muted);
    if (report?.fusions) text(790, `${report.fusions} fusão(ões) na última batalha.`, 22, theme.muted);
    new TextButton(this, 360, 910, 'Nova jornada', () => this.scene.start('ShopScene', { session: null }),
      { width: 520, height: 76 });
    new TextButton(this, 360, 1110, 'Voltar ao menu', () => this.scene.start('MenuScene'),
      { height: 56, fontSize: 22 });
  }
}
