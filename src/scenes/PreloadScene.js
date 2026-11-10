import Phaser from 'phaser';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    this.logoFailed = false;
    this.load.setPath('assets/');
    this.load.image('ulbris-logo', 'brand/ulbris-logo.webp');
    this.load.once('loaderror', file => { if (file.key === 'ulbris-logo') this.logoFailed = true; });
  }

  create() {
    if (this.logoFailed) {
      // PNG fallback for browsers that cannot decode WebP. Menus retain a text fallback too.
      this.load.image('ulbris-logo', 'brand/ulbris-logo.png');
      this.load.once('complete', () => this.scene.start('MenuScene'));
      this.load.start();
      return;
    }
    this.scene.start('MenuScene');
  }
}
