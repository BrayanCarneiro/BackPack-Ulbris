import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import { theme } from '../config/theme.js';
import addBrandLogo from '../components/BrandLogo.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const { width, height } = this.scale;
    const centerX = width / 2;

    this.add.circle(centerX, height * 0.34, 245, theme.surface);
    this.add.text(centerX, height * 0.16, 'ORGANIZE. PLANEJE. AVANCE.', {
      fontFamily: theme.fontFamily,
      fontSize: '20px',
      color: theme.muted,
    }).setOrigin(0.5);

    this.logo = addBrandLogo(this, centerX, height * 0.35, { width: 1060, height: 597 });

    this.add.text(centerX, height * 0.57, 'Cada espaço, uma possibilidade.', {
      fontFamily: theme.fontFamily,
      fontSize: '25px',
      color: theme.muted,
    }).setOrigin(0.5);

    new TextButton(this, centerX, height * 0.66, 'Iniciar', () => {
      this.scene.start('LobbyScene');
    });
  }
}
