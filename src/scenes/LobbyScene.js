import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import { theme } from '../config/theme.js';

export default class LobbyScene extends Phaser.Scene {
  constructor() {
    super('LobbyScene');
  }

  create() {
    this.add.circle(360, 430, 230, theme.surface);
    this.add.text(360, 350, 'ULBRIS', {
      fontFamily: theme.fontFamily, fontSize: '52px', fontStyle: 'bold', color: theme.text,
    }).setOrigin(0.5);
    this.add.text(360, 445, 'Prepare sua próxima jornada.', {
      fontFamily: theme.fontFamily, fontSize: '24px', color: theme.muted,
    }).setOrigin(0.5);
    new TextButton(this, 360, 750, 'Play', () => this.scene.start('ShopScene', { session: null }));
    new TextButton(this, 360, 870, 'Itens', () => this.scene.start('ItemCatalogScene'));
  }
}
