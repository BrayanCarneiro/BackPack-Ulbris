import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import { theme } from '../config/theme.js';
import addBrandLogo from '../components/BrandLogo.js';

export default class LobbyScene extends Phaser.Scene {
  constructor() {
    super('LobbyScene');
  }

  create() {
    this.add.circle(360, 430, 230, theme.surface);
    this.logo = addBrandLogo(this, 360, 425, { width: 1060, height: 597 });
    this.add.text(360, 660, 'Prepare sua próxima jornada.', {
      fontFamily: theme.fontFamily, fontSize: '24px', color: theme.muted,
    }).setOrigin(0.5);
    new TextButton(this, 360, 750, 'Play', () => this.scene.start('ShopScene', { session: null }));
    new TextButton(this, 360, 870, 'Itens', () => this.scene.start('ItemCatalogScene'));
  }
}
