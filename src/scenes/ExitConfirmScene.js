import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import { theme } from '../config/theme.js';

export default class ExitConfirmScene extends Phaser.Scene {
  constructor() {
    super('ExitConfirmScene');
  }

  create({ sourceKey, onConfirm }) {
    this.sourceKey = sourceKey;
    this.onConfirm = onConfirm;
    this.renderPanel();
    this.scale.on('resize', this.renderPanel, this);
    this.input.keyboard.on('keydown-ESC', this.close, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.renderPanel, this);
      this.input.keyboard.off('keydown-ESC', this.close, this);
    });
  }

  renderPanel() {
    this.children.removeAll(true);
    const center = this.scale.width / 2;
    const offsetY = (this.scale.height - 1280) / 2;
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x080f13, 0.7)
      .setOrigin(0).setInteractive();
    this.add.rectangle(center, 640 + offsetY, 620, 360, theme.surface)
      .setStrokeStyle(2, theme.accent, 0.5).setInteractive();
    this.add.text(center, 555 + offsetY, 'Você já iniciou uma jornada tem certeza que quer sair ?', {
      fontFamily: theme.fontFamily, fontSize: '28px', color: theme.text,
      align: 'center', wordWrap: { width: 540 }, lineSpacing: 10,
    }).setOrigin(0.5);
    new TextButton(this, center - 140, 720 + offsetY, 'Sim', () => {
      // The original callback belongs to the paused source scene.
      this.onConfirm();
      this.scene.stop();
    }, { width: 230, height: 64, fontSize: 26 });
    new TextButton(this, center + 140, 720 + offsetY, 'Não', () => this.close(),
      { width: 230, height: 64, fontSize: 26 });
  }

  close() {
    this.scene.stop();
  }
}
