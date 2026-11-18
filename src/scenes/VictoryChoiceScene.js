import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import { theme } from '../config/theme.js';
import { bindRunSession } from '../systems/RunSave.js';

export default class VictoryChoiceScene extends Phaser.Scene {
  constructor() {
    super('VictoryChoiceScene');
  }

  create({ session, report }) {
    if (!bindRunSession(session)) { this.scene.start('LobbyScene'); return; }
    this.scale.setGameSize(720, 1280);
    const center = this.scale.width / 2;
    const middle = this.scale.height / 2;
    this.add.rectangle(center, middle, 640, 480, theme.surface).setStrokeStyle(2, theme.accent, 0.5);
    this.add.text(center, middle - 150, 'Você conquistou 10 vitórias!', {
      fontFamily: theme.fontFamily, fontSize: '30px', color: theme.text, align: 'center',
    }).setOrigin(0.5);
    this.add.text(center, middle - 65, 'Continue com sua mochila e suas vidas restantes.\nAté onde você consegue chegar?', {
      fontFamily: theme.fontFamily, fontSize: '22px', color: theme.muted, align: 'center',
      wordWrap: { width: 560 }, lineSpacing: 10,
    }).setOrigin(0.5);
    this.continueButton = new TextButton(this, center, middle + 50, 'Continuar no modo infinito', () => {
      if (session.continueEndless()) this.scene.start('ShopScene', { session });
    }, { width: 560, height: 76, fontSize: 27 });
    this.finishButton = new TextButton(this, center, middle + 155, 'Terminar', () => {
      this.scene.start('RunEndScene', { session, report });
    }, { width: 560, height: 76, fontSize: 27, secondary: true });
  }
}
